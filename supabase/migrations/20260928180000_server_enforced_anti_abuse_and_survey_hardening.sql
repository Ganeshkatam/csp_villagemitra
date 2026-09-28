-- ==============================================================================
-- Migration: 20260928180000_server_enforced_anti_abuse_and_survey_hardening
-- Purpose: 
-- 1. Server-side adversarial validation for public submit_survey() RPC:
--    - Verify village_id exists in villages catalog.
--    - Header string bounds (respondent_code, interviewer_name, notes).
--    - Temporal validity (no future timestamps, completed_at >= started_at).
--    - Cardinality bounds on answers payload (1 to 60 answers).
--    - Question existence check against survey_questions for each answer.
--    - Type enforcement on household size D5 (positive integer between 1 and 30).
-- 2. Populate canonical options for D6, INFRA1, SCH4 in survey_questions.
-- 3. Server-enforced anti-abuse and anti-replay triggers on citizen_feedback:
--    - Temporal replay check: rejects identical messages within 5 minutes.
--    - Temporal contact rate limit: max 1 submission per phone number per 60 seconds.
--    - Global village burst protection: max 30 submissions per minute per village.
--    - Input bounds: name <= 100, phone <= 25 chars.
-- ==============================================================================

-- 1. Populate canonical options for D6, INFRA1, SCH4 if empty
UPDATE public.survey_questions
SET options = '[{"value": "White-BPL-Card", "label": "White Ration Card (Rice Card / BPL)"}, {"value": "Pink-APL-Card", "label": "Pink Ration Card (APL)"}, {"value": "No-Card", "label": "No Ration Card"}]'::jsonb
WHERE question_code = 'D6' AND (options IS NULL OR options = '[]'::jsonb);

UPDATE public.survey_questions
SET options = '[{"value": "Panchayat-RO-Plant", "label": "Panchayat RO Purified Water Plant"}, {"value": "Borewell-Tap", "label": "Direct Borewell / Street Tap"}, {"value": "Private-Tanker-Can", "label": "Private Water Tanker or 20L Cans"}]'::jsonb
WHERE question_code = 'INFRA1' AND (options IS NULL OR options = '[]'::jsonb);

UPDATE public.survey_questions
SET options = '[{"value": "Aarogyasri", "label": "Dr. YSR Aarogyasri Health Insurance"}, {"value": "Amma-Vodi", "label": "Amma Vodi Educational Support"}, {"value": "PM-KISAN", "label": "PM-KISAN / Rythu Bharosa"}, {"value": "Pension-Kanuka", "label": "YSR Pension Kanuka"}, {"value": "None", "label": "None of the above"}]'::jsonb
WHERE question_code = 'SCH4' AND (options IS NULL OR options = '[]'::jsonb);

-- 2. Harden submit_survey RPC with adversarial validations
CREATE OR REPLACE FUNCTION public.submit_survey(
    p_village_id UUID,
    p_respondent_code TEXT,
    p_interviewer_name TEXT,
    p_ward_street TEXT DEFAULT NULL,
    p_locality_ward TEXT DEFAULT NULL,
    p_started_at TIMESTAMPTZ DEFAULT NULL,
    p_completed_at TIMESTAMPTZ DEFAULT NULL,
    p_survey_client_uuid UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_answers JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_response_id UUID;
    v_answer JSONB;
    v_inserted_count INT := 0;
    v_clean_code TEXT;
    v_clean_interviewer TEXT;
    v_clean_ward TEXT;
    v_clean_locality TEXT;
    v_q_code TEXT;
    v_a_val TEXT;
    v_q_rec RECORD;
    v_d5_val INT;
BEGIN
    -- 1. Idempotency guard: if a response with this client UUID already exists, return existing
    IF p_survey_client_uuid IS NOT NULL THEN
        SELECT id INTO v_response_id
        FROM public.survey_responses
        WHERE survey_client_uuid = p_survey_client_uuid;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'response_id', v_response_id,
                'already_existed', true,
                'answers_count', (SELECT COUNT(*) FROM public.survey_answers WHERE response_id = v_response_id)
            );
        END IF;
    END IF;

    -- 2. Input validation on header metadata
    IF p_village_id IS NULL THEN
        RAISE EXCEPTION 'village_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.villages WHERE id = p_village_id) THEN
        RAISE EXCEPTION 'Invalid village_id: village does not exist';
    END IF;

    v_clean_code := trim(p_respondent_code);
    IF v_clean_code IS NULL OR length(v_clean_code) < 2 OR length(v_clean_code) > 50 THEN
        RAISE EXCEPTION 'respondent_code must be between 2 and 50 characters';
    END IF;

    v_clean_interviewer := trim(p_interviewer_name);
    IF v_clean_interviewer IS NULL OR length(v_clean_interviewer) < 2 OR length(v_clean_interviewer) > 100 THEN
        RAISE EXCEPTION 'interviewer_name must be between 2 and 100 characters';
    END IF;

    v_clean_ward := NULLIF(trim(p_ward_street), '');
    v_clean_locality := NULLIF(trim(p_locality_ward), '');

    IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
        RAISE EXCEPTION 'notes exceeds maximum permitted length of 2000 characters';
    END IF;

    -- Temporal validation
    IF p_started_at IS NOT NULL AND p_started_at > (now() + interval '10 minutes') THEN
        RAISE EXCEPTION 'started_at cannot be in the future';
    END IF;
    IF p_completed_at IS NOT NULL AND p_completed_at > (now() + interval '10 minutes') THEN
        RAISE EXCEPTION 'completed_at cannot be in the future';
    END IF;
    IF p_started_at IS NOT NULL AND p_completed_at IS NOT NULL AND p_completed_at < p_started_at THEN
        RAISE EXCEPTION 'completed_at cannot precede started_at';
    END IF;

    -- 3. Answers payload validation & cardinality enforcement
    IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
        RAISE EXCEPTION 'answers must be a valid JSON array';
    END IF;

    IF jsonb_array_length(p_answers) < 1 THEN
        RAISE EXCEPTION 'answers payload cannot be empty';
    END IF;

    IF jsonb_array_length(p_answers) > 60 THEN
        RAISE EXCEPTION 'answers payload exceeds maximum permitted count of 60 answers';
    END IF;

    -- Validate each answer prior to mutating state
    FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        v_q_code := trim(v_answer->>'question_code');
        v_a_val := trim(v_answer->>'answer_value');

        IF v_q_code IS NULL OR v_q_code = '' THEN
            RAISE EXCEPTION 'question_code is required for all answer entries';
        END IF;

        IF v_a_val IS NULL OR v_a_val = '' THEN
            RAISE EXCEPTION 'answer_value is required for question %', v_q_code;
        END IF;

        IF length(v_a_val) > 500 THEN
            RAISE EXCEPTION 'answer_value for % exceeds maximum permitted length of 500 characters', v_q_code;
        END IF;

        -- Validate that question_code exists in registered questionnaire
        SELECT question_code, question_type, options INTO v_q_rec
        FROM public.survey_questions
        WHERE question_code = v_q_code;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unrecognized question_code: %', v_q_code;
        END IF;

        -- Specific type validation for household size number
        IF v_q_rec.question_type = 'number' AND v_q_code = 'D5' THEN
            IF v_a_val !~ '^[0-9]+$' THEN
                RAISE EXCEPTION 'Household size D5 must be a positive integer';
            END IF;
            v_d5_val := v_a_val::int;
            IF v_d5_val < 1 OR v_d5_val > 30 THEN
                RAISE EXCEPTION 'Household size D5 must be between 1 and 30';
            END IF;
        END IF;
    END LOOP;

    -- 4. Atomic insertion of survey response header
    INSERT INTO public.survey_responses (
        village_id,
        respondent_code,
        interviewer_name,
        ward_street,
        locality_ward,
        consent_obtained,
        started_at,
        completed_at,
        survey_client_uuid,
        notes
    ) VALUES (
        p_village_id,
        v_clean_code,
        v_clean_interviewer,
        v_clean_ward,
        v_clean_locality,
        true,
        p_started_at,
        p_completed_at,
        p_survey_client_uuid,
        p_notes
    )
    RETURNING id INTO v_response_id;

    -- 5. Atomic insertion of validated answers
    FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
    LOOP
        INSERT INTO public.survey_answers (
            response_id,
            question_code,
            answer_value,
            notes
        ) VALUES (
            v_response_id,
            trim(v_answer->>'question_code'),
            trim(v_answer->>'answer_value'),
            NULLIF(trim(v_answer->>'notes'), '')
        )
        ON CONFLICT (response_id, question_code, answer_value) DO NOTHING;
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'response_id', v_response_id,
        'already_existed', false,
        'answers_count', v_inserted_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_survey(
    UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, JSONB
) TO anon, authenticated;

-- 3. Server-enforced anti-abuse on citizen_feedback
CREATE OR REPLACE FUNCTION public.enforce_citizen_feedback_abuse_guards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_recent_same_message INT;
    v_recent_same_phone INT;
    v_recent_village_total INT;
BEGIN
    -- 1. Name and phone length sanity checks
    IF NEW.name IS NOT NULL AND length(trim(NEW.name)) > 100 THEN
        RAISE EXCEPTION 'Name exceeds maximum allowed length of 100 characters';
    END IF;

    IF NEW.phone IS NOT NULL AND length(trim(NEW.phone)) > 25 THEN
        RAISE EXCEPTION 'Phone number exceeds maximum allowed length of 25 characters';
    END IF;

    -- 2. Anti-replay protection: prevent identical message within 5 minutes
    SELECT COUNT(*) INTO v_recent_same_message
    FROM public.citizen_feedback
    WHERE message = NEW.message
      AND created_at > (now() - interval '5 minutes');

    IF v_recent_same_message > 0 THEN
        RAISE EXCEPTION 'Duplicate feedback detected. An identical message was recently submitted.';
    END IF;

    -- 3. Temporal phone rate limiting: max 1 submission per phone per 60 seconds
    IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
        SELECT COUNT(*) INTO v_recent_same_phone
        FROM public.citizen_feedback
        WHERE phone = trim(NEW.phone)
          AND created_at > (now() - interval '60 seconds');

        IF v_recent_same_phone > 0 THEN
            RAISE EXCEPTION 'Rate limit exceeded: only one feedback submission allowed per phone number per minute.';
        END IF;
    END IF;

    -- 4. Global village spike protection: max 30 submissions per minute across village
    SELECT COUNT(*) INTO v_recent_village_total
    FROM public.citizen_feedback
    WHERE village_id = NEW.village_id
      AND created_at > (now() - interval '1 minute');

    IF v_recent_village_total >= 30 THEN
        RAISE EXCEPTION 'Feedback rate limit temporarily exceeded for this village. Please retry in a few moments.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_citizen_feedback_abuse_guards ON public.citizen_feedback;
CREATE TRIGGER trg_enforce_citizen_feedback_abuse_guards
    BEFORE INSERT ON public.citizen_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_citizen_feedback_abuse_guards();
