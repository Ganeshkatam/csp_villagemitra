-- ==============================================================================
-- Migration: 20260930020000_harden_security_definer_and_cohort_privacy
-- Purpose: Restrict SECURITY DEFINER RPC exposure, enforce k-anonymity (k >= 5)
--          on public analytics, and accurately track affected survey answer counts.
-- ==============================================================================

-- 1. Revoke execute on trigger function from all public API roles
REVOKE EXECUTE ON FUNCTION public.enforce_citizen_feedback_abuse_guards() FROM PUBLIC, anon, authenticated;

-- 2. Restrict is_admin() helper from anonymous execution
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. Restrict administrative user management RPCs from anonymous execution
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_user(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;

-- 4. Harden get_survey_analytics_summary with k-anonymity (k >= 5) cohort threshold
CREATE OR REPLACE FUNCTION public.get_survey_analytics_summary(filter_ward text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    result json;
    total_count int;
    v_is_admin boolean;
BEGIN
    v_is_admin := public.is_admin();

    IF filter_ward IS NOT NULL AND filter_ward <> 'ALL' THEN
        SELECT count(*) INTO total_count 
        FROM public.survey_responses 
        WHERE locality_ward = filter_ward;

        -- Enforce k-anonymity privacy protection (k >= 5) for public requests
        IF total_count < 5 AND NOT v_is_admin THEN
            RETURN json_build_object(
                'total_responses', total_count,
                'summary_generated_at', now(),
                'filter_ward', filter_ward,
                'privacy_suppressed', true,
                'privacy_notice', 'Detailed distributions are suppressed for cohorts under 5 respondents to prevent re-identification.',
                'question_distributions', '{}'::json,
                'locality_distribution', json_build_object(filter_ward, total_count)
            );
        END IF;

        SELECT json_build_object(
            'total_responses', total_count,
            'summary_generated_at', now(),
            'filter_ward', filter_ward,
            'privacy_suppressed', false,
            'question_distributions', (
                SELECT coalesce(json_object_agg(question_code, options_data), '{}'::json)
                FROM (
                    SELECT 
                        question_code,
                        json_object_agg(answer_value, cnt) as options_data
                    FROM (
                        SELECT 
                            sa.question_code, 
                            sa.answer_value, 
                            count(*) as cnt
                        FROM public.survey_answers sa
                        INNER JOIN public.survey_responses sr ON sa.response_id = sr.id
                        WHERE sr.locality_ward = filter_ward
                        GROUP BY sa.question_code, sa.answer_value
                        ORDER BY sa.question_code, cnt DESC
                    ) sub
                    GROUP BY question_code
                ) grouped
            ),
            'locality_distribution', (
                SELECT coalesce(json_object_agg(locality_ward, cnt), '{}'::json)
                FROM (
                    SELECT coalesce(locality_ward, 'General') as locality_ward, count(*) as cnt
                    FROM public.survey_responses
                    GROUP BY locality_ward
                ) loc
            )
        ) INTO result;
    ELSE
        SELECT count(*) INTO total_count FROM public.survey_responses;

        SELECT json_build_object(
            'total_responses', total_count,
            'summary_generated_at', now(),
            'filter_ward', 'ALL',
            'privacy_suppressed', false,
            'question_distributions', (
                SELECT coalesce(json_object_agg(question_code, options_data), '{}'::json)
                FROM (
                    SELECT 
                        question_code, 
                        json_object_agg(answer_value, cnt) as options_data
                    FROM (
                        SELECT 
                            question_code, 
                            answer_value, 
                            count(*) as cnt
                        FROM public.survey_answers
                        GROUP BY question_code, answer_value
                        ORDER BY question_code, cnt DESC
                    ) sub
                    GROUP BY question_code
                ) grouped
            ),
            'locality_distribution', (
                SELECT coalesce(json_object_agg(locality_ward, cnt), '{}'::json)
                FROM (
                    SELECT coalesce(locality_ward, 'General') as locality_ward, count(*) as cnt
                    FROM public.survey_responses
                    GROUP BY locality_ward
                ) loc
            )
        ) INTO result;
    END IF;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_survey_analytics_summary(text) TO anon, authenticated;

-- 5. Harden submit_survey counter accuracy
DROP FUNCTION IF EXISTS public.submit_survey(uuid,text,text,text,text,timestamp with time zone,timestamp with time zone,uuid,text,jsonb);

CREATE OR REPLACE FUNCTION public.submit_survey(
    p_village_id UUID,
    p_respondent_code TEXT,
    p_interviewer_name TEXT,
    p_ward_street TEXT,
    p_locality_ward TEXT,
    p_started_at TIMESTAMPTZ,
    p_completed_at TIMESTAMPTZ,
    p_survey_client_uuid UUID,
    p_notes TEXT,
    p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_clean_code TEXT;
    v_clean_interviewer TEXT;
    v_clean_ward TEXT;
    v_clean_locality TEXT;
    v_response_id UUID;
    v_existing_id UUID;
    v_answer JSONB;
    v_q_code TEXT;
    v_a_val TEXT;
    v_q_rec RECORD;
    v_d5_val INT;
    v_inserted_count INT := 0;
BEGIN
    -- 1. Input sanitization and bounds enforcement
    v_clean_code := trim(p_respondent_code);
    v_clean_interviewer := trim(p_interviewer_name);
    v_clean_ward := trim(p_ward_street);
    v_clean_locality := trim(p_locality_ward);

    IF v_clean_code IS NULL OR length(v_clean_code) < 3 OR length(v_clean_code) > 50 THEN
        RAISE EXCEPTION 'respondent_code must be between 3 and 50 characters';
    END IF;

    IF v_clean_interviewer IS NULL OR length(v_clean_interviewer) < 2 OR length(v_clean_interviewer) > 100 THEN
        RAISE EXCEPTION 'interviewer_name must be between 2 and 100 characters';
    END IF;

    IF v_clean_ward IS NULL OR length(v_clean_ward) < 2 OR length(v_clean_ward) > 200 THEN
        RAISE EXCEPTION 'ward_street must be between 2 and 200 characters';
    END IF;

    IF v_clean_locality IS NULL OR length(v_clean_locality) < 2 OR length(v_clean_locality) > 100 THEN
        RAISE EXCEPTION 'locality_ward must be between 2 and 100 characters';
    END IF;

    -- Validate village exists
    IF NOT EXISTS (SELECT 1 FROM public.villages WHERE id = p_village_id) THEN
        RAISE EXCEPTION 'Specified village does not exist';
    END IF;

    -- Validate started_at and completed_at
    IF p_started_at IS NOT NULL AND p_completed_at IS NOT NULL AND p_completed_at < p_started_at THEN
        RAISE EXCEPTION 'completed_at cannot precede started_at';
    END IF;

    -- 2. Idempotency Check: if survey_client_uuid already exists, return existing record
    IF p_survey_client_uuid IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.survey_responses
        WHERE survey_client_uuid = p_survey_client_uuid;

        IF v_existing_id IS NOT NULL THEN
            SELECT count(*) INTO v_inserted_count
            FROM public.survey_answers
            WHERE response_id = v_existing_id;

            RETURN jsonb_build_object(
                'success', true,
                'response_id', v_existing_id,
                'already_existed', true,
                'answers_count', v_inserted_count
            );
        END IF;
    END IF;

    -- 3. Validate answers array
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

    -- 5. Atomic insertion of validated answers with accurate insertion count
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
        
        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
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
