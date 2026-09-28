-- ==============================================================================
-- Migration: 20260928173138_atomic_survey_ingestion_and_idempotency
-- Purpose: Atomic survey ingestion RPC with client UUID idempotency guard.
-- Replaces multi-step REST insertions with a single transaction.
-- ==============================================================================

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

    -- 2. Input validation
    IF p_village_id IS NULL THEN
        RAISE EXCEPTION 'village_id is required';
    END IF;
    IF p_respondent_code IS NULL OR trim(p_respondent_code) = '' THEN
        RAISE EXCEPTION 'respondent_code is required';
    END IF;
    IF p_interviewer_name IS NULL OR trim(p_interviewer_name) = '' THEN
        RAISE EXCEPTION 'interviewer_name is required';
    END IF;

    -- 3. Atomic insertion of survey response header
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
        trim(p_respondent_code),
        trim(p_interviewer_name),
        trim(p_ward_street),
        trim(p_locality_ward),
        true,
        p_started_at,
        p_completed_at,
        p_survey_client_uuid,
        p_notes
    )
    RETURNING id INTO v_response_id;

    -- 4. Atomic insertion of answers if provided
    IF p_answers IS NOT NULL AND jsonb_array_length(p_answers) > 0 THEN
        FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers)
        LOOP
            INSERT INTO public.survey_answers (
                response_id,
                question_code,
                answer_value,
                notes
            ) VALUES (
                v_response_id,
                v_answer->>'question_code',
                v_answer->>'answer_value',
                v_answer->>'notes'
            )
            ON CONFLICT (response_id, question_code, answer_value) DO NOTHING;
            
            v_inserted_count := v_inserted_count + 1;
        END LOOP;
    END IF;

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
