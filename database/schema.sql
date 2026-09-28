-- ==============================================================================
-- CSP Village Information Portal & Survey System — Consolidated Schema Baseline
-- Architecture: Supabase PostgreSQL (Postgres 15+)
-- Scope: Modavalasa Gram Panchayat (Denkada Mandal, Vizianagaram District)
-- Rules: Zero emojis, explicit verification metadata, strict RLS, immutable search_path
-- Synchronization: Matches live database migration baseline through phase_0 hardening
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. MASTER HABITATION CONFIGURATION
-- ==============================================================================
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pin TEXT DEFAULT '531162',
    sub_post_office TEXT DEFAULT 'Chittivalasa S.O.',
    branch_post_office TEXT DEFAULT 'Modavalasa B.O.',
    postal_division TEXT DEFAULT 'Visakhapatnam Division',
    census_village_code TEXT DEFAULT '583218',
    power_utility TEXT DEFAULT 'APEPDCL',
    electricity_helpline TEXT DEFAULT '1912'
);

CREATE INDEX IF NOT EXISTS idx_villages_name ON public.villages(name);

-- ==============================================================================
-- 3. ADMINISTRATIVE ACCESS CONTROL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. VILLAGE LOCALITIES CATALOG
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.village_localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    locality_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    source TEXT NOT NULL DEFAULT 'Panchayat Cadastral Survey',
    verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verification_method TEXT,
    CONSTRAINT uq_village_locality UNIQUE (village_id, locality_name)
);

-- ==============================================================================
-- 5. STANDARDIZED SURVEY INSTRUMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_code TEXT UNIQUE NOT NULL,
    section TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options JSONB,
    required BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_order ON public.survey_questions(display_order);

INSERT INTO public.survey_questions (question_code, section, question_text, question_type, options, required, display_order)
VALUES
    ('D1', 'Demographics', 'Age Group of Respondent', 'single_choice', 
     '[{"value": "18-25", "label": "18 to 25 years"}, {"value": "26-40", "label": "26 to 40 years"}, {"value": "41-60", "label": "41 to 60 years"}, {"value": "Above-60", "label": "Above 60 years"}]'::jsonb, true, 1),
    ('D2', 'Demographics', 'Gender', 'single_choice', 
     '[{"value": "Male", "label": "Male"}, {"value": "Female", "label": "Female"}, {"value": "Other", "label": "Other / Prefer not to say"}]'::jsonb, true, 2),
    ('D3', 'Demographics', 'Primary Occupation of Household Head', 'single_choice', 
     '[{"value": "Agriculture", "label": "Farming / Agriculture"}, {"value": "Agricultural-Labor", "label": "Farm Labor / Daily Wage Work"}, {"value": "Artisan-Trades", "label": "Local Trades (Weaver, Carpenter, Tailor)"}, {"value": "Small-Business", "label": "Shopkeeper / Small Business / Vendor"}, {"value": "Salaried-Service", "label": "Salaried Job (Private or Government)"}, {"value": "Other", "label": "Other Work"}]'::jsonb, true, 3),
    ('D4', 'Demographics', 'Highest Education Level in Household', 'single_choice', 
     '[{"value": "Non-literate", "label": "No formal schooling"}, {"value": "Primary", "label": "Primary School (Class 1 to 5)"}, {"value": "Secondary", "label": "High School (Class 6 to 10)"}, {"value": "Higher-Secondary", "label": "Intermediate / 12th Class"}, {"value": "Graduate-Diploma", "label": "Degree / Diploma / Higher"}]'::jsonb, true, 4),
    ('D5', 'Demographics', 'Total Household Members', 'number', NULL, false, 5),
    ('D6', 'Demographics', 'Ration Card Category Held', 'single_select',
     '[{"value": "White-BPL-Card", "label": "White Ration Card (Rice Card / BPL)"}, {"value": "Pink-APL-Card", "label": "Pink Ration Card (APL)"}, {"value": "No-Card", "label": "No Ration Card"}]'::jsonb, true, 6),
    ('TECH1', 'Digital Infrastructure', 'Working Smartphone Availability in Household', 'single_choice', 
     '[{"value": "Smartphone-Available", "label": "Yes, have a smartphone"}, {"value": "Basic-Phone-Only", "label": "Basic keypad phone only"}, {"value": "No-Phone", "label": "No phone in the house"}]'::jsonb, true, 7),
    ('TECH2', 'Digital Infrastructure', 'Primary Internet Access Mode', 'single_choice', 
     '[{"value": "Mobile-Data-4G-5G", "label": "Mobile data (4G / 5G)"}, {"value": "Broadband-WiFi", "label": "Home Wi-Fi / Broadband"}, {"value": "Intermittent-2G-3G", "label": "Slow or weak mobile signal (2G / 3G)"}, {"value": "No-Internet", "label": "No internet access at home"}]'::jsonb, true, 8),
    ('TECH3', 'Digital Infrastructure', 'Independent Digital Browsing & Reading', 'single_choice', 
     '[{"value": "Independent", "label": "Can use websites and read online on my own"}, {"value": "Needs-Assistance", "label": "Need help from family or youth to read online"}, {"value": "Relies-on-Cafes", "label": "Go to internet centers or CSC for online work"}]'::jsonb, true, 9),
    ('SCH1', 'Welfare Schemes', 'Primary Source for Learning About Welfare Schemes', 'single_choice', 
     '[{"value": "Panchayat-Notices", "label": "Panchayat notice board and announcements"}, {"value": "Word-of-Mouth", "label": "Neighbors and friends"}, {"value": "CSC-Cafe", "label": "Internet center (CSC) / Net cafe"}, {"value": "Official-Web", "label": "Official government websites"}, {"value": "Social-Media", "label": "Social media (WhatsApp, YouTube)"}]'::jsonb, true, 10),
    ('SCH2', 'Welfare Schemes', 'Biggest Challenge When Applying for Schemes', 'single_choice', 
     '[{"value": "Unknown-Eligibility-Docs", "label": "Do not know required papers or rules in advance"}, {"value": "Repeated-Office-Visits", "label": "Having to visit offices multiple times for missing papers"}, {"value": "Unsure-Official-Link", "label": "Not sure if an online website link is real"}, {"value": "Intermediary-Fees", "label": "Having to pay money to middlemen for information"}, {"value": "No-Hurdle", "label": "No difficulty faced"}]'::jsonb, true, 11),
    ('SCH3', 'Welfare Schemes', 'Confusion Identifying Official Government Domains (.gov.in)', 'single_choice', 
     '[{"value": "Frequently-Confused", "label": "Often confused by private or unofficial websites"}, {"value": "Sometimes-Unsure", "label": "Sometimes unsure if a link is genuine"}, {"value": "Easily-Distinguish", "label": "Can easily tell official government (.gov.in) websites"}, {"value": "Do-Not-Use", "label": "Do not use online government websites"}]'::jsonb, true, 12),
    ('SCH4', 'Welfare Schemes', 'Active Government Welfare Scheme Entitlements', 'multi_select',
     '[{"value": "PM-KISAN", "label": "PM-KISAN / Rythu Bharosa"}, {"value": "Pension-Kanuka", "label": "YSR Pension Kanuka (Old Age / Widow / Disability)"}, {"value": "Amma-Vodi", "label": "Amma Vodi / Vidya Deevena"}, {"value": "Aarogyasri", "label": "Dr. YSR Aarogyasri Health Scheme"}, {"value": "None", "label": "None of these schemes"}]'::jsonb, true, 13),
    ('CON1_Panchayat', 'Emergency Contacts', 'Has Panchayat Secretary / Sarpanch Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 14),
    ('CON1_PHC', 'Emergency Contacts', 'Has Primary Health Centre / Ambulance Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 15),
    ('CON1_Police', 'Emergency Contacts', 'Has Police Station / Outpost Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 16),
    ('CON1_Lineman', 'Emergency Contacts', 'Has Electricity Lineman / Water Operator Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 17),
    ('CON2', 'Emergency Contacts', 'How Emergency Contacts Are Looked Up in Crisis', 'single_choice', 
     '[{"value": "Ask-Neighbors", "label": "Ask neighbors or friends"}, {"value": "Visit-Panchayat", "label": "Visit Panchayat office in person"}, {"value": "Saved-In-Phone", "label": "Already have numbers saved in mobile phone"}, {"value": "Struggle-To-Find", "label": "Hard to find the right number quickly"}]'::jsonb, true, 18),
    ('HLTH1', 'Healthcare & Education', 'How Doctor Availability at PHC is Checked', 'single_choice', 
     '[{"value": "Visited-PHC-No-Doctor", "label": "Went to the clinic when urgent, but doctor was not there"}, {"value": "No-Way-To-Check", "label": "No way to check doctor timings in advance"}, {"value": "Regular-Satisfactory", "label": "Clinic is open and doctor is available when needed"}]'::jsonb, true, 19),
    ('EDU1', 'Healthcare & Education', 'Ease of Obtaining School / Anganwadi Details', 'single_choice', 
     '[{"value": "Easily-Accessible", "label": "School and Anganwadi details are easy to get"}, {"value": "Scattered-Requires-Visits", "label": "Hard to find details without visiting in person"}, {"value": "No-School-Children", "label": "No school-age children in the house"}]'::jsonb, true, 20),
    ('INFRA1', 'Community Infrastructure', 'Primary Source of Potable Drinking Water', 'single_select',
     '[{"value": "Panchayat-RO-Plant", "label": "Panchayat RO Drinking Water Plant"}, {"value": "Borewell-Tap", "label": "Direct Borewell or Tap Water"}, {"value": "Private-Tanker-Can", "label": "Private Water Cans or Tankers"}]'::jsonb, true, 21),
    ('BIZ1', 'Local Economy', 'How Village Tradespeople (Mechanic, Tailor, Electrician) Are Found', 'single_choice', 
     '[{"value": "Personal-Contacts", "label": "Ask neighbors or personal contacts"}, {"value": "Market-Inquiry", "label": "Ask around at village shops"}, {"value": "Struggle-To-Find", "label": "Hard to find skilled workers nearby"}]'::jsonb, true, 22),
    ('BIZ2', 'Local Economy', 'Utility of Verified Village Business & SHG Directory', 'single_choice', 
     '[{"value": "Very-Helpful", "label": "Very helpful to find local repairers and shops"}, {"value": "Somewhat-Helpful", "label": "Somewhat helpful"}, {"value": "Not-Necessary", "label": "Not needed"}]'::jsonb, true, 23),
    ('PRIO1', 'Citizen Priorities', 'Top Priority Category for Village Information Portal', 'single_choice', 
     '[{"value": "Emergency-Contacts", "label": "Emergency phone numbers and clinic contacts"}, {"value": "Welfare-Checklists", "label": "Government schemes list and required documents"}, {"value": "PHC-Timings", "label": "Doctor timings at the primary health centre"}, {"value": "Business-Directory", "label": "Phone numbers of local repairers and shops"}, {"value": "Panchayat-Notices", "label": "Panchayat announcements and meeting updates"}, {"value": "School-Anganwadi", "label": "School and Anganwadi timings and updates"}]'::jsonb, true, 24)
ON CONFLICT (question_code) DO NOTHING;

-- ==============================================================================
-- 6. PSEUDONYMOUS HOUSEHOLD INTERVIEWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    respondent_code TEXT NOT NULL,
    interviewer_name TEXT NOT NULL,
    ward_street TEXT,
    consent_obtained BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locality_ward TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    survey_client_uuid UUID,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_village ON public.survey_responses(village_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_code ON public.survey_responses(respondent_code);
CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_client_uuid_uidx ON public.survey_responses(survey_client_uuid);

-- ==============================================================================
-- 7. NORMALIZED SURVEY ANSWERS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
    question_code TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_response_question_answer UNIQUE (response_id, question_code, answer_value)
);

CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON public.survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_qc ON public.survey_answers(question_code);
CREATE INDEX IF NOT EXISTS idx_survey_answers_qc_val ON public.survey_answers(question_code, answer_value);

-- ==============================================================================
-- 8. VERIFIED GOVERNMENT WELFARE SCHEMES
-- ==============================================================================
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    name_te TEXT,
    description_te TEXT,
    eligibility_te TEXT,
    documents_te TEXT,
    image_url TEXT,
    department TEXT,
    benefits TEXT,
    exclusions TEXT,
    application_process TEXT
);

CREATE INDEX IF NOT EXISTS idx_schemes_village_status ON public.schemes(village_id, status);
CREATE INDEX IF NOT EXISTS idx_schemes_category ON public.schemes(category);
CREATE INDEX IF NOT EXISTS idx_schemes_village_cat ON public.schemes(village_id, category);

-- ==============================================================================
-- 9. EMERGENCY & ADMINISTRATIVE CONTACTS
-- ==============================================================================
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
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    name_te TEXT,
    designation_te TEXT,
    jurisdiction TEXT DEFAULT 'Local Habitation',
    verification_method TEXT,
    address_verified BOOLEAN DEFAULT false,
    address_status TEXT,
    phone_verified BOOLEAN DEFAULT false,
    locality TEXT,
    mandal TEXT,
    district TEXT,
    state TEXT,
    pin TEXT,
    landmark TEXT
);

CREATE INDEX IF NOT EXISTS idx_contacts_village_status ON public.contacts(village_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON public.contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_village_cat ON public.contacts(village_id, category);

-- ==============================================================================
-- 10. PUBLIC INSTITUTIONS
-- ==============================================================================
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    name_te TEXT,
    services_te TEXT,
    image_url TEXT,
    verification_method TEXT,
    address_verified BOOLEAN DEFAULT false,
    address_status TEXT,
    phone_verified BOOLEAN DEFAULT false,
    locality TEXT,
    mandal TEXT,
    district TEXT,
    state TEXT,
    pin TEXT,
    landmark TEXT
);

CREATE INDEX IF NOT EXISTS idx_institutions_village_status ON public.institutions(village_id, status);
CREATE INDEX IF NOT EXISTS idx_institutions_type ON public.institutions(type);
CREATE INDEX IF NOT EXISTS idx_institutions_village_type ON public.institutions(village_id, type);

-- ==============================================================================
-- 11. LOCAL BUSINESSES & MICRO-ENTERPRISES
-- ==============================================================================
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    name_te TEXT,
    services_te TEXT,
    image_url TEXT,
    verification_method TEXT,
    address_verified BOOLEAN DEFAULT false,
    address_status TEXT,
    phone_verified BOOLEAN DEFAULT false,
    locality TEXT,
    mandal TEXT,
    district TEXT,
    state TEXT,
    pin TEXT,
    landmark TEXT
);

CREATE INDEX IF NOT EXISTS idx_businesses_village_status ON public.businesses(village_id, status);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_village_cat ON public.businesses(village_id, category);

-- ==============================================================================
-- 12. PUBLIC ANNOUNCEMENTS
-- ==============================================================================
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
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_announcements_village_status ON public.announcements(village_id, status);

-- ==============================================================================
-- 13. CITIZEN FEEDBACK
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.citizen_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
    name TEXT,
    phone TEXT,
    feedback_type TEXT NOT NULL DEFAULT 'General',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference_id TEXT UNIQUE,
    CONSTRAINT chk_citizen_feedback_message_length CHECK (length(trim(message)) >= 10 AND length(message) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_feedback_village_status ON public.citizen_feedback(village_id, status);

-- ==============================================================================
-- 14. HEALTHCARE CLINICAL SCHEDULES
-- ==============================================================================
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

-- ==============================================================================
-- 15. HEALTHCARE IMMUNIZATION SCHEDULES
-- ==============================================================================
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

-- ==============================================================================
-- 16. HEALTHCARE DIAGNOSTIC SERVICES
-- ==============================================================================
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

-- ==============================================================================
-- 17. ANALYTICAL VIEWS
-- Pinned with security_invoker = true to respect caller RLS context
-- ==============================================================================
DROP VIEW IF EXISTS public.view_survey_metric_counts;

CREATE VIEW public.view_survey_metric_counts
WITH (security_invoker = true) AS
SELECT 
    sa.question_code,
    sa.answer_value,
    COUNT(*)::INTEGER AS response_count,
    ROUND((COUNT(*)::NUMERIC / NULLIF((
        SELECT COUNT(*) 
        FROM public.survey_answers sub 
        WHERE sub.question_code = sa.question_code
    ), 0)) * 100, 1) AS percentage_of_question_answers
FROM public.survey_answers sa
GROUP BY sa.question_code, sa.answer_value
ORDER BY sa.question_code, response_count DESC;

-- ==============================================================================
-- 18. FUNCTIONS & PROCEDURES
-- All functions pinned with immutable search_path TO 'public', 'pg_temp'
-- ==============================================================================

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

-- Revoke execute on administrative RPCs from anon and public roles
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text) FROM anon, PUBLIC;

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

REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM anon, PUBLIC;

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

CREATE OR REPLACE FUNCTION public.get_survey_analytics_summary(filter_ward text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    result json;
    total_count int;
BEGIN
    IF filter_ward IS NOT NULL AND filter_ward <> 'ALL' THEN
        SELECT count(*) INTO total_count 
        FROM public.survey_responses 
        WHERE locality_ward = filter_ward;

        SELECT json_build_object(
            'total_responses', total_count,
            'summary_generated_at', now(),
            'filter_ward', filter_ward,
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

-- ==============================================================================
-- 19. ROW LEVEL SECURITY (RLS) POLICIES
-- Enabled on all 14 public tables
-- ==============================================================================

ALTER TABLE public.villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.village_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citizen_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_services ENABLE ROW LEVEL SECURITY;

-- 19.1 Villages Policies
DROP POLICY IF EXISTS "Public read access to villages" ON public.villages;
DROP POLICY IF EXISTS "Public read villages" ON public.villages;
DROP POLICY IF EXISTS "Admin manage villages" ON public.villages;
DROP POLICY IF EXISTS "Admin insert villages" ON public.villages;
DROP POLICY IF EXISTS "Admin update villages" ON public.villages;
DROP POLICY IF EXISTS "Admin delete villages" ON public.villages;

CREATE POLICY "Public read access to villages"
  ON public.villages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin insert villages"
  ON public.villages FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin update villages"
  ON public.villages FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin delete villages"
  ON public.villages FOR DELETE
  TO authenticated
  USING (is_admin());

-- 19.2 Admin Users Policies
DROP POLICY IF EXISTS "Users read own admin profile" ON public.admin_users;
CREATE POLICY "Users read own admin profile"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 19.3 Village Localities Policies
DROP POLICY IF EXISTS "Allow public read access on village_localities" ON public.village_localities;
CREATE POLICY "Allow public read access on village_localities"
  ON public.village_localities FOR SELECT
  TO anon, authenticated
  USING (true);

-- 19.4 Survey Questions Policies
DROP POLICY IF EXISTS "Public read survey questions" ON public.survey_questions;
DROP POLICY IF EXISTS "Admin manage survey questions" ON public.survey_questions;

CREATE POLICY "Public read survey questions"
  ON public.survey_questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage survey questions"
  ON public.survey_questions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.5 Survey Responses Policies
DROP POLICY IF EXISTS "Admin manage survey responses" ON public.survey_responses;
DROP POLICY IF EXISTS "Surveyors insert survey responses" ON public.survey_responses;

CREATE POLICY "Surveyors insert survey responses"
  ON public.survey_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent_obtained = true);

CREATE POLICY "Admin manage survey responses"
  ON public.survey_responses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.6 Survey Answers Policies
DROP POLICY IF EXISTS "Admin manage survey answers" ON public.survey_answers;
DROP POLICY IF EXISTS "Surveyors insert survey answers" ON public.survey_answers;

CREATE POLICY "Surveyors insert survey answers"
  ON public.survey_answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin manage survey answers"
  ON public.survey_answers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.7 Schemes Policies
DROP POLICY IF EXISTS "Public read published schemes" ON public.schemes;
DROP POLICY IF EXISTS "Admin manage schemes" ON public.schemes;

CREATE POLICY "Public read published schemes"
  ON public.schemes FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage schemes"
  ON public.schemes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.8 Contacts Policies
DROP POLICY IF EXISTS "Public read published contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admin manage contacts" ON public.contacts;

CREATE POLICY "Public read published contacts"
  ON public.contacts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage contacts"
  ON public.contacts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.9 Institutions Policies
DROP POLICY IF EXISTS "Public read published institutions" ON public.institutions;
DROP POLICY IF EXISTS "Admin manage institutions" ON public.institutions;

CREATE POLICY "Public read published institutions"
  ON public.institutions FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage institutions"
  ON public.institutions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.10 Businesses Policies
DROP POLICY IF EXISTS "Public read published businesses" ON public.businesses;
DROP POLICY IF EXISTS "Admin manage businesses" ON public.businesses;

CREATE POLICY "Public read published businesses"
  ON public.businesses FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage businesses"
  ON public.businesses FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.11 Announcements Policies
DROP POLICY IF EXISTS "Public read published announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin manage announcements" ON public.announcements;

CREATE POLICY "Public read published announcements"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage announcements"
  ON public.announcements FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.12 Citizen Feedback Policies
DROP POLICY IF EXISTS "Public insert citizen feedback" ON public.citizen_feedback;
DROP POLICY IF EXISTS "Admin manage citizen feedback" ON public.citizen_feedback;

CREATE POLICY "Public insert citizen feedback"
  ON public.citizen_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin manage citizen feedback"
  ON public.citizen_feedback FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 19.13 Clinical Schedules Policies
DROP POLICY IF EXISTS "Public read published clinical schedules" ON public.clinical_schedules;
DROP POLICY IF EXISTS "Admin manage clinical schedules" ON public.clinical_schedules;

CREATE POLICY "Public read published clinical schedules"
  ON public.clinical_schedules FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage clinical schedules"
  ON public.clinical_schedules FOR ALL
  TO authenticated
  USING (is_admin());

-- 19.14 Immunization Schedules Policies
DROP POLICY IF EXISTS "Public read published immunization schedules" ON public.immunization_schedules;
DROP POLICY IF EXISTS "Admin manage immunization schedules" ON public.immunization_schedules;

CREATE POLICY "Public read published immunization schedules"
  ON public.immunization_schedules FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage immunization schedules"
  ON public.immunization_schedules FOR ALL
  TO authenticated
  USING (is_admin());

-- 19.15 Diagnostic Services Policies
DROP POLICY IF EXISTS "Public read published diagnostic services" ON public.diagnostic_services;
DROP POLICY IF EXISTS "Admin manage diagnostic services" ON public.diagnostic_services;

CREATE POLICY "Public read published diagnostic services"
  ON public.diagnostic_services FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admin manage diagnostic services"
  ON public.diagnostic_services FOR ALL
  TO authenticated
  USING (is_admin());
