-- ==============================================================================
-- CSP Village Information Portal & Survey System — Initial Schema Baseline
-- Architecture: Supabase PostgreSQL (Postgres 15+)
-- Scope: Modavalasa Gram Panchayat (Denkada Mandal, Vizianagaram District)
-- Rules: Zero emojis, explicit verification metadata, strict RLS, immutable search_path
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Master Habitation Configuration
CREATE TABLE IF NOT EXISTS public.villages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gram_panchayat TEXT NOT NULL,
    mandal TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Andhra Pradesh',
    description TEXT,
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_villages_name ON public.villages(name);

-- 3. Administrator Access Control
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Welfare Schemes
CREATE TABLE IF NOT EXISTS public.schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    eligibility TEXT NOT NULL,
    documents TEXT NOT NULL,
    official_url TEXT NOT NULL,
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name_te TEXT,
    description_te TEXT,
    eligibility_te TEXT,
    documents_te TEXT,
    department TEXT,
    benefits TEXT,
    exclusions TEXT,
    application_process TEXT
);

CREATE INDEX IF NOT EXISTS idx_schemes_category ON public.schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_village_cat ON public.schemes(village_id, category);

-- 5. Emergency & Administrative Contacts
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT,
    category TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    availability TEXT,
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name_te TEXT,
    designation_te TEXT,
    jurisdiction TEXT DEFAULT 'Local Habitation'
);

CREATE INDEX IF NOT EXISTS idx_contacts_category ON public.contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_village_cat ON public.contacts(village_id, category);

-- 6. Public Institutions
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    timings TEXT NOT NULL,
    services TEXT NOT NULL,
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name_te TEXT,
    services_te TEXT
);

CREATE INDEX IF NOT EXISTS idx_institutions_type ON public.institutions(type);
CREATE INDEX IF NOT EXISTS idx_institutions_village_type ON public.institutions(village_id, type);

-- 7. Local Businesses & Micro-Enterprises
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_name TEXT,
    category TEXT NOT NULL,
    services TEXT,
    address TEXT,
    phone TEXT,
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name_te TEXT,
    services_te TEXT
);

CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_village_cat ON public.businesses(village_id, category);

-- 8. Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    title_te TEXT,
    description TEXT NOT NULL,
    description_te TEXT,
    event_date DATE,
    category TEXT NOT NULL DEFAULT 'General',
    source TEXT NOT NULL,
    verified_on DATE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Citizen Feedback
CREATE TABLE IF NOT EXISTS public.citizen_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT,
    phone TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'General',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    reference_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_village_status ON public.citizen_feedback(village_id, status);

-- 10. Survey Responses & Answers Base Tables
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    respondent_code TEXT NOT NULL,
    interviewer_name TEXT NOT NULL,
    ward_street TEXT,
    consent_obtained BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_village ON public.survey_responses(village_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_code ON public.survey_responses(respondent_code);

CREATE TABLE IF NOT EXISTS public.survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
    question_code TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_response_question UNIQUE (response_id, question_code)
);

CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON public.survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_qc ON public.survey_answers(question_code);
CREATE INDEX IF NOT EXISTS idx_survey_answers_qc_val ON public.survey_answers(question_code, answer_value);

-- 11. Clinical Schedules
CREATE TABLE IF NOT EXISTS public.clinical_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    facility_name TEXT NOT NULL,
    doctor_role TEXT NOT NULL,
    doctor_role_te TEXT,
    doctor_name TEXT,
    days_active TEXT NOT NULL,
    days_active_te TEXT,
    timings TEXT NOT NULL,
    timings_te TEXT,
    room_or_desk TEXT NOT NULL,
    room_or_desk_te TEXT,
    services_offered TEXT,
    services_offered_te TEXT,
    source TEXT NOT NULL DEFAULT 'Denkada PHC Duty Roster / DMHO Vizianagaram',
    verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_schedules_village_status ON public.clinical_schedules(village_id, status);

-- 12. Immunization Schedules
CREATE TABLE IF NOT EXISTS public.immunization_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    session_name_te TEXT,
    frequency_or_date TEXT NOT NULL,
    frequency_or_date_te TEXT,
    timings TEXT NOT NULL,
    timings_te TEXT,
    venue TEXT NOT NULL,
    venue_te TEXT,
    target_cohort TEXT NOT NULL,
    target_cohort_te TEXT,
    vaccines_administered TEXT NOT NULL,
    supervising_worker TEXT NOT NULL,
    supervising_worker_te TEXT,
    source TEXT NOT NULL DEFAULT 'WDCW & DMHO Vizianagaram Universal Immunization Program',
    verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immunization_schedules_village_status ON public.immunization_schedules(village_id, status);

-- 13. Diagnostic Services
CREATE TABLE IF NOT EXISTS public.diagnostic_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_name_te TEXT,
    category TEXT NOT NULL,
    category_te TEXT,
    sample_type TEXT NOT NULL,
    sample_type_te TEXT,
    turnaround_time TEXT NOT NULL,
    turnaround_time_te TEXT,
    availability TEXT NOT NULL DEFAULT 'Available Daily',
    availability_te TEXT,
    fee TEXT NOT NULL DEFAULT 'Free (Government NHM / AP Health)',
    fee_te TEXT DEFAULT 'ఉచితం (ప్రభుత్వ ఆరోగ్య సేవ)',
    prerequisites TEXT,
    prerequisites_te TEXT,
    source TEXT NOT NULL DEFAULT 'Denkada PHC Clinical Laboratory Guidelines',
    verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_services_village_status ON public.diagnostic_services(village_id, status);

-- 14. Core Security & RPC Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    RETURN (
        auth.role() = 'authenticated'
        AND EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_user(new_email text, temp_password text, user_role text DEFAULT 'admin'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_clean_email text := lower(trim(new_email));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only verified administrators can create users.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_clean_email) THEN
    RAISE EXCEPTION 'A user with this email already exists.';
  END IF;

  IF length(temp_password) < 6 THEN
    RAISE EXCEPTION 'Temporary password must be at least 6 characters.';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    crypt(temp_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', user_role, 'must_change_password', true),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
    'email',
    v_clean_email,
    now(),
    now(),
    now()
  );

  IF user_role = 'admin' THEN
    INSERT INTO public.admin_users (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_user_id,
    'email', v_clean_email
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(id uuid, email character varying, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, must_change_password boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only verified administrators can view accounts.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    COALESCE((u.raw_user_meta_data->>'must_change_password')::boolean, false) as must_change_password
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_feedback_status(p_reference_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_rec record;
    v_clean_ref text;
BEGIN
    v_clean_ref := upper(trim(p_reference_id));
    
    IF v_clean_ref IS NULL OR length(v_clean_ref) < 5 THEN
        RETURN json_build_object(
            'found', false,
            'message', 'Invalid reference ID format'
        );
    END IF;

    SELECT reference_id, feedback_type, status, created_at
    INTO v_rec
    FROM public.citizen_feedback
    WHERE upper(reference_id) = v_clean_ref;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'found', false,
            'message', 'No record found with this reference ID'
        );
    END IF;

    RETURN json_build_object(
        'found', true,
        'reference_id', v_rec.reference_id,
        'category', v_rec.feedback_type,
        'status', COALESCE(v_rec.status, 'Pending Verification'),
        'submitted_at', v_rec.created_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_citizen_feedback_reference_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
        NEW.reference_id := 'VM-FB-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');
    END IF;
    IF NEW.status IS NULL OR NEW.status = '' THEN
        NEW.status := 'Pending Verification';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_citizen_feedback_reference_id ON public.citizen_feedback;
CREATE TRIGGER trg_set_citizen_feedback_reference_id
    BEFORE INSERT ON public.citizen_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.set_citizen_feedback_reference_id();
