-- ==============================================================================
-- Migration: 20260930010000_create_server_authoritative_search_portal
-- Purpose: Hardened Server-Authoritative Global Search Infrastructure (Phase 1 & 2)
-- Architecture: PostgreSQL Native (pg_trgm + to_tsvector FTS + verified aliases + unified DTO)
-- Security: SECURITY DEFINER, pinned search_path, published-only, bounded output
-- ==============================================================================

-- 1. Enable pg_trgm extension for fuzzy trigram similarity
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Immutable search normalization function
CREATE OR REPLACE FUNCTION public.search_normalization(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT trim(regexp_replace(lower(p_text), '[\s\-_+()/,.:;!?''"]+', ' ', 'g'));
$$;

-- 3. Verified Civic Search Aliases Catalog Table
CREATE TABLE IF NOT EXISTS public.search_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias_key TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_url TEXT NOT NULL,
    target_title TEXT NOT NULL,
    target_title_te TEXT,
    target_category TEXT NOT NULL,
    relevance_boost NUMERIC NOT NULL DEFAULT 0.95,
    source TEXT NOT NULL DEFAULT 'Grama Panchayat Verified Keyword',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_aliases_key ON public.search_aliases(alias_key);
CREATE INDEX IF NOT EXISTS idx_search_aliases_key_trgm ON public.search_aliases USING gin (alias_key gin_trgm_ops);

-- Seed Canonical Civic Aliases (Idempotent)
INSERT INTO public.search_aliases (alias_key, target_type, target_url, target_title, target_title_te, target_category, source)
VALUES
    ('phc', 'healthcare', '/healthcare', 'Primary Health Centre (PHC) Denkada', 'ప్రాథమిక ఆరోగ్య కేంద్రం డెంకాడ', 'Healthcare Facility', 'DMHO Vizianagaram'),
    ('primary health centre', 'healthcare', '/healthcare', 'Primary Health Centre (PHC) Denkada', 'ప్రాథమిక ఆరోగ్య కేంద్రం డెంకాడ', 'Healthcare Facility', 'DMHO Vizianagaram'),
    ('పీహెచ్‌సీ', 'healthcare', '/healthcare', 'Primary Health Centre (PHC) Denkada', 'ప్రాథమిక ఆరోగ్య కేంద్రం డెంకాడ', 'Healthcare Facility', 'DMHO Vizianagaram'),
    ('ఆరోగ్య కేంద్రం', 'healthcare', '/healthcare', 'Primary Health Centre (PHC) Denkada', 'ప్రాథమిక ఆరోగ్య కేంద్రం డెంకాడ', 'Healthcare Facility', 'DMHO Vizianagaram'),
    ('108', 'contact', '/contacts/emergency', '108 Emergency Ambulance', '108 అత్యవసర అంబులెన్స్', 'Emergency', 'Government of AP Health Dept'),
    ('100', 'contact', '/contacts/police', '100 Police Control Room', '100 పోలీస్ కంట్రోల్ రూమ్', 'Police', 'AP Police'),
    ('104', 'contact', '/contacts/healthcare', '104 Mobile Medical & Health Helpline', '104 మొబైల్ వైద్య సేవలు', 'Healthcare', 'AP Health Dept'),
    ('1912', 'contact', '/contacts/utilities', '1912 Electricity Toll-Free (APEPDCL)', '1912 విద్యుత్ టోల్ ఫ్రీ', 'Utilities', 'APEPDCL Roster'),
    ('asha', 'contact', '/contacts/healthcare', 'ASHA Community Health Worker', 'ఆశా ఆరోగ్య కార్యకర్త', 'Healthcare', 'PHC Denkada'),
    ('ఆశా', 'contact', '/contacts/healthcare', 'ASHA Community Health Worker', 'ఆశా ఆరోగ్య కార్యకర్త', 'Healthcare', 'PHC Denkada'),
    ('anganwadi', 'education', '/education', 'Anganwadi Centre Modavalasa', 'అంగన్‌వాడీ కేంద్రం మోదవలస', 'Educational Institution', 'WDCW AP'),
    ('అంగన్‌వాడీ', 'education', '/education', 'Anganwadi Centre Modavalasa', 'అంగన్‌వాడీ కేంద్రం మోదవలస', 'Educational Institution', 'WDCW AP'),
    ('school', 'education', '/education', 'Mandal Parishad Primary School (MPPS)', 'మండల పరిషత్ ప్రాథమిక పాఠశాల (MPPS)', 'Educational Institution', 'Education Dept AP'),
    ('mpps', 'education', '/education', 'Mandal Parishad Primary School (MPPS)', 'మండల పరిషత్ ప్రాథమిక పాఠశాల (MPPS)', 'Educational Institution', 'Education Dept AP'),
    ('బడి', 'education', '/education', 'Mandal Parishad Primary School (MPPS)', 'మండల పరిషత్ ప్రాథమిక పాఠశాల (MPPS)', 'Educational Institution', 'Education Dept AP'),
    ('పాఠశాల', 'education', '/education', 'Mandal Parishad Primary School (MPPS)', 'మండల పరిషత్ ప్రాథమిక పాఠశాల (MPPS)', 'Educational Institution', 'Education Dept AP'),
    ('zphs', 'education', '/education', 'Zilla Parishad High School (ZPHS)', 'జిల్లా పరిషత్ ఉన్నత పాఠశాల', 'Educational Institution', 'Education Dept AP'),
    ('pension', 'scheme', '/schemes', 'YSR Pension Kanuka', 'వైఎస్సార్ పింఛను కానుక', 'Social Security', 'Social Welfare AP'),
    ('పెన్షన్', 'scheme', '/schemes', 'YSR Pension Kanuka', 'వైఎస్సార్ పింఛను కానుక', 'Social Security', 'Social Welfare AP'),
    ('pm kisan', 'scheme', '/schemes', 'PM-Kisan / Rythu Bharosa', 'పీఎం కిసాన్ / రైతు భరోసా', 'Agriculture', 'Agriculture Dept AP'),
    ('రైతు భరోసా', 'scheme', '/schemes', 'PM-Kisan / Rythu Bharosa', 'పీఎం కిసాన్ / రైతు భరోసా', 'Agriculture', 'Agriculture Dept AP'),
    ('aarogyasri', 'scheme', '/schemes', 'Dr. YSR Aarogyasri Health Insurance', 'డాక్టర్ వైఎస్సార్ ఆరోగ్యశ్రీ', 'Healthcare', 'Aarogyasri Health Care Trust'),
    ('ఆరోగ్యశ్రీ', 'scheme', '/schemes', 'Dr. YSR Aarogyasri Health Insurance', 'డాక్టర్ వైఎస్సార్ ఆరోగ్యశ్రీ', 'Healthcare', 'Aarogyasri Health Care Trust'),
    ('water', 'contact', '/contacts/administration', 'Drinking Water & RO Plant Desk', 'తాగునీటి మరియు ఆర్వో ప్లాంట్ డెస్క్', 'Administration', 'Modavalasa Gram Panchayat'),
    ('తాగునీరు', 'contact', '/contacts/administration', 'Drinking Water & RO Plant Desk', 'తాగునీటి మరియు ఆర్వో ప్లాంట్ డెస్క్', 'Administration', 'Modavalasa Gram Panchayat')
ON CONFLICT DO NOTHING;

-- 4. English & Telugu Trigram Indexes and Expression Indexes
CREATE INDEX IF NOT EXISTS idx_schemes_name_trgm ON public.schemes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_schemes_name_te_trgm ON public.schemes USING gin (name_te gin_trgm_ops) WHERE name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schemes_norm_name_trgm ON public.schemes USING gin ((public.search_normalization(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_schemes_status_village ON public.schemes(status, village_id);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_name_te_trgm ON public.contacts USING gin (name_te gin_trgm_ops) WHERE name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_norm_name_trgm ON public.contacts USING gin ((public.search_normalization(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status_village ON public.contacts(status, village_id, jurisdiction);

CREATE INDEX IF NOT EXISTS idx_institutions_name_trgm ON public.institutions USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_name_te_trgm ON public.institutions USING gin (name_te gin_trgm_ops) WHERE name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_institutions_norm_name_trgm ON public.institutions USING gin ((public.search_normalization(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_status_village ON public.institutions(status, village_id, type);

CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON public.businesses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_name_te_trgm ON public.businesses USING gin (name_te gin_trgm_ops) WHERE name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_norm_name_trgm ON public.businesses USING gin ((public.search_normalization(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_status_village ON public.businesses(status, village_id);

CREATE INDEX IF NOT EXISTS idx_announcements_title_trgm ON public.announcements USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_announcements_title_te_trgm ON public.announcements USING gin (title_te gin_trgm_ops) WHERE title_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_norm_title_trgm ON public.announcements USING gin ((public.search_normalization(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_announcements_status_village ON public.announcements(status, village_id);

CREATE INDEX IF NOT EXISTS idx_clinical_schedules_role_trgm ON public.clinical_schedules USING gin (doctor_role gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_schedules_role_te_trgm ON public.clinical_schedules USING gin (doctor_role_te gin_trgm_ops) WHERE doctor_role_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_schedules_status ON public.clinical_schedules(status, village_id);

CREATE INDEX IF NOT EXISTS idx_immunization_schedules_name_trgm ON public.immunization_schedules USING gin (session_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_immunization_schedules_name_te_trgm ON public.immunization_schedules USING gin (session_name_te gin_trgm_ops) WHERE session_name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_immunization_schedules_status ON public.immunization_schedules(status, village_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_services_name_trgm ON public.diagnostic_services USING gin (test_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_diagnostic_services_name_te_trgm ON public.diagnostic_services USING gin (test_name_te gin_trgm_ops) WHERE test_name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_services_status ON public.diagnostic_services(status, village_id);

-- 5. Unified Server-Authoritative Global Search RPC
CREATE OR REPLACE FUNCTION public.search_portal(
    p_query TEXT,
    p_village_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    title TEXT,
    title_te TEXT,
    subtitle TEXT,
    category TEXT,
    url TEXT,
    score NUMERIC,
    verified_at DATE,
    phone TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_clean_q TEXT;
    v_norm_q TEXT;
    v_digits_q TEXT;
    v_limit INT;
    v_effective_village UUID;
    v_tsq tsquery;
    v_has_tsq BOOLEAN := false;
BEGIN
    -- Input sanitization and bounds enforcement
    IF p_query IS NULL OR length(trim(p_query)) = 0 THEN
        RETURN;
    END IF;

    -- Bound query length to 100 characters maximum
    v_clean_q := substring(trim(p_query) from 1 for 100);
    v_norm_q := public.search_normalization(v_clean_q);

    IF length(v_norm_q) = 0 THEN
        RETURN;
    END IF;

    -- Extract digit-only token for phone number searches
    v_digits_q := regexp_replace(v_clean_q, '\D', '', 'g');

    -- Bounded results count (1 to 50, default 20)
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);

    -- Village scope fallback
    v_effective_village := COALESCE(p_village_id, '00000000-0000-0000-0000-000000000001'::uuid);

    -- Prepare Full-Text Search tsquery using simple dictionary
    BEGIN
        v_tsq := plainto_tsquery('simple', v_clean_q);
        v_has_tsq := (v_tsq IS NOT NULL AND v_tsq::text <> '');
    EXCEPTION WHEN OTHERS THEN
        v_has_tsq := false;
    END;

    RETURN QUERY
    WITH raw_candidates AS (
        -- 0. Verified Civic Search Aliases
        SELECT
            sa.target_type AS entity_type,
            sa.id AS entity_id,
            sa.target_title AS title,
            sa.target_title_te AS title_te,
            ('Verified civic service shortcut for "' || sa.alias_key || '"') AS subtitle,
            sa.target_category AS category,
            sa.target_url AS url,
            CURRENT_DATE AS verified_at,
            NULL::TEXT AS phone,
            (sa.target_title || ' ' || COALESCE(sa.target_title_te, '') || ' ' || sa.alias_key) AS search_text,
            true AS is_alias_match
        FROM public.search_aliases sa
        WHERE sa.status = 'published'
          AND (v_norm_q = public.search_normalization(sa.alias_key) 
               OR public.search_normalization(sa.alias_key) LIKE ('%' || v_norm_q || '%'))

        UNION ALL

        -- 1. Schemes
        SELECT 
            'scheme'::TEXT AS entity_type,
            s.id AS entity_id,
            s.name AS title,
            s.name_te AS title_te,
            substring(s.description from 1 for 180) AS subtitle,
            s.category AS category,
            ('/schemes/' || s.id::text) AS url,
            s.verified_on AS verified_at,
            NULL::TEXT AS phone,
            (s.name || ' ' || COALESCE(s.name_te, '') || ' ' || s.category || ' ' || s.description) AS search_text,
            false AS is_alias_match
        FROM public.schemes s
        WHERE s.status = 'published'
          AND s.village_id = v_effective_village

        UNION ALL

        -- 2. Emergency & Admin Contacts (With District / State / Universal Helpline Exemption)
        SELECT 
            'contact'::TEXT AS entity_type,
            c.id AS entity_id,
            c.name AS title,
            c.name_te AS title_te,
            COALESCE(c.designation, c.category) AS subtitle,
            c.category AS category,
            ('/contacts/' || lower(replace(c.category, ' ', '-'))) AS url,
            c.verified_on AS verified_at,
            c.phone AS phone,
            (c.name || ' ' || COALESCE(c.name_te, '') || ' ' || c.category || ' ' || COALESCE(c.designation, '') || ' ' || COALESCE(c.phone, '')) AS search_text,
            false AS is_alias_match
        FROM public.contacts c
        WHERE c.status = 'published'
          AND (c.village_id = v_effective_village 
               OR c.category = 'Emergency' 
               OR c.jurisdiction IN ('State', 'District', 'Mandal', 'Universal'))

        UNION ALL

        -- 3. Healthcare Facilities (Institutions: PHC)
        SELECT 
            'healthcare'::TEXT AS entity_type,
            i.id AS entity_id,
            i.name AS title,
            i.name_te AS title_te,
            COALESCE(i.services, i.timings) AS subtitle,
            'Healthcare Facility'::TEXT AS category,
            ('/healthcare/' || i.id::text) AS url,
            i.verified_on AS verified_at,
            i.phone AS phone,
            (i.name || ' ' || COALESCE(i.name_te, '') || ' ' || i.services || ' PHC clinic hospital ఆరోగ్య కేంద్రం') AS search_text,
            false AS is_alias_match
        FROM public.institutions i
        WHERE i.status = 'published'
          AND i.type = 'PHC'
          AND i.village_id = v_effective_village

        UNION ALL

        -- 4. Education Institutions (Institutions: Education)
        SELECT 
            'education'::TEXT AS entity_type,
            i.id AS entity_id,
            i.name AS title,
            i.name_te AS title_te,
            COALESCE(i.services, i.timings) AS subtitle,
            'Educational Institution'::TEXT AS category,
            ('/education/' || i.id::text) AS url,
            i.verified_on AS verified_at,
            i.phone AS phone,
            (i.name || ' ' || COALESCE(i.name_te, '') || ' ' || i.services || ' school anganwadi mpps zphs బడి పాఠశాల') AS search_text,
            false AS is_alias_match
        FROM public.institutions i
        WHERE i.status = 'published'
          AND i.type = 'Education'
          AND i.village_id = v_effective_village

        UNION ALL

        -- 5. Local Businesses & Artisans
        SELECT 
            'business'::TEXT AS entity_type,
            b.id AS entity_id,
            b.name AS title,
            b.name_te AS title_te,
            COALESCE(b.services, b.owner_name) AS subtitle,
            b.category AS category,
            ('/businesses/' || b.id::text) AS url,
            b.verified_on AS verified_at,
            b.phone AS phone,
            (b.name || ' ' || COALESCE(b.name_te, '') || ' ' || b.category || ' ' || COALESCE(b.services, '') || ' ' || COALESCE(b.owner_name, '')) AS search_text,
            false AS is_alias_match
        FROM public.businesses b
        WHERE b.status = 'published'
          AND b.village_id = v_effective_village

        UNION ALL

        -- 6. Announcements & Public Notices
        SELECT 
            'announcement'::TEXT AS entity_type,
            a.id AS entity_id,
            a.title AS title,
            a.title_te AS title_te,
            substring(a.description from 1 for 180) AS subtitle,
            a.category AS category,
            ('/announcements/' || a.id::text) AS url,
            a.verified_on AS verified_at,
            NULL::TEXT AS phone,
            (a.title || ' ' || COALESCE(a.title_te, '') || ' ' || a.category || ' ' || a.description) AS search_text,
            false AS is_alias_match
        FROM public.announcements a
        WHERE a.status = 'published'
          AND a.village_id = v_effective_village

        UNION ALL

        -- 7. Clinical Schedules (PHC Doctor Roster)
        SELECT 
            'clinical_schedule'::TEXT AS entity_type,
            cs.id AS entity_id,
            cs.doctor_role AS title,
            cs.doctor_role_te AS title_te,
            (COALESCE(cs.doctor_name, '') || ' • ' || cs.days_active || ' (' || cs.timings || ')') AS subtitle,
            'PHC Duty Roster'::TEXT AS category,
            '/healthcare#clinical'::TEXT AS url,
            cs.verified_on AS verified_at,
            NULL::TEXT AS phone,
            (cs.doctor_role || ' ' || COALESCE(cs.doctor_role_te, '') || ' ' || COALESCE(cs.doctor_name, '') || ' ' || cs.days_active || ' doctor clinic opd డాక్టర్') AS search_text,
            false AS is_alias_match
        FROM public.clinical_schedules cs
        WHERE cs.status = 'published'
          AND cs.village_id = v_effective_village

        UNION ALL

        -- 8. Immunization Schedules
        SELECT 
            'immunization_schedule'::TEXT AS entity_type,
            im.id AS entity_id,
            im.session_name AS title,
            im.session_name_te AS title_te,
            (im.vaccines_administered || ' • ' || im.target_cohort || ' at ' || im.venue) AS subtitle,
            'Immunization Schedule'::TEXT AS category,
            '/healthcare#immunization'::TEXT AS url,
            im.verified_on AS verified_at,
            NULL::TEXT AS phone,
            (im.session_name || ' ' || COALESCE(im.session_name_te, '') || ' ' || im.vaccines_administered || ' vaccine vaccination polio టీకా') AS search_text,
            false AS is_alias_match
        FROM public.immunization_schedules im
        WHERE im.status = 'published'
          AND im.village_id = v_effective_village

        UNION ALL

        -- 9. Diagnostic Services (Lab Tests)
        SELECT 
            'diagnostic_service'::TEXT AS entity_type,
            ds.id AS entity_id,
            ds.test_name AS title,
            ds.test_name_te AS title_te,
            (ds.sample_type || ' • TAT: ' || ds.turnaround_time || ' • ' || ds.fee) AS subtitle,
            ds.category AS category,
            '/healthcare#diagnostics'::TEXT AS url,
            ds.verified_on AS verified_at,
            NULL::TEXT AS phone,
            (ds.test_name || ' ' || COALESCE(ds.test_name_te, '') || ' ' || ds.category || ' lab test blood diagnostic పరీక్ష ల్యాబ్') AS search_text,
            false AS is_alias_match
        FROM public.diagnostic_services ds
        WHERE ds.status = 'published'
          AND ds.village_id = v_effective_village
    ),
    ranked_candidates AS (
        SELECT 
            rc.entity_type,
            rc.entity_id,
            rc.title,
            rc.title_te,
            rc.subtitle,
            rc.category,
            rc.url,
            rc.verified_at,
            rc.phone,
            ROUND(CAST(
                GREATEST(
                    -- 1. Exact title match in English or Telugu (1.00)
                    CASE WHEN v_norm_q = public.search_normalization(rc.title) 
                           OR (rc.title_te IS NOT NULL AND v_norm_q = public.search_normalization(rc.title_te)) 
                         THEN 1.00 ELSE 0.00 END,
                    -- 2. Verified civic alias match (0.95)
                    CASE WHEN rc.is_alias_match THEN 0.95 ELSE 0.00 END,
                    -- 3. Exact phone match (0.95)
                    CASE WHEN rc.phone IS NOT NULL AND length(v_digits_q) >= 3 
                              AND regexp_replace(rc.phone, '\D', '', 'g') = v_digits_q 
                         THEN 0.95 ELSE 0.00 END,
                    -- 4. Title prefix match in English or Telugu (0.85)
                    CASE WHEN public.search_normalization(rc.title) LIKE (v_norm_q || '%') 
                           OR (rc.title_te IS NOT NULL AND public.search_normalization(rc.title_te) LIKE (v_norm_q || '%')) 
                         THEN 0.85 ELSE 0.00 END,
                    -- 5. Full-text search match via ts_rank (0.80)
                    CASE WHEN v_has_tsq AND to_tsvector('simple', rc.search_text) @@ v_tsq 
                         THEN LEAST(0.80, 0.50 + (ts_rank(to_tsvector('simple', rc.search_text), v_tsq) * 0.5)) 
                         ELSE 0.00 END,
                    -- 6. Title token / word match in English or Telugu (0.75)
                    CASE WHEN public.search_normalization(rc.title) LIKE ('%' || v_norm_q || '%') 
                           OR (rc.title_te IS NOT NULL AND public.search_normalization(rc.title_te) LIKE ('%' || v_norm_q || '%')) 
                         THEN 0.75 ELSE 0.00 END,
                    -- 7. Phone contains digit substring (0.70)
                    CASE WHEN rc.phone IS NOT NULL AND length(v_digits_q) >= 3 
                              AND regexp_replace(rc.phone, '\D', '', 'g') LIKE ('%' || v_digits_q || '%') 
                         THEN 0.70 ELSE 0.00 END,
                    -- 8. Category match (0.60)
                    CASE WHEN public.search_normalization(rc.category) LIKE ('%' || v_norm_q || '%') 
                         THEN 0.60 ELSE 0.00 END,
                    -- 9. Subtitle / description substring match (0.40)
                    CASE WHEN rc.subtitle IS NOT NULL AND public.search_normalization(rc.subtitle) LIKE ('%' || v_norm_q || '%') 
                         THEN 0.40 ELSE 0.00 END,
                    -- 10. Trigram fuzzy similarity on title (0.25 - 0.50)
                    CASE WHEN similarity(rc.title, v_clean_q) > 0.25 
                         THEN (0.25 + (similarity(rc.title, v_clean_q) * 0.25)) 
                         ELSE 0.00 END
                ) AS NUMERIC
            ), 2) AS score
        FROM raw_candidates rc
    )
    SELECT 
        r.entity_type,
        r.entity_id,
        r.title,
        r.title_te,
        r.subtitle,
        r.category,
        r.url,
        r.score,
        r.verified_at,
        r.phone
    FROM ranked_candidates r
    WHERE r.score >= 0.25
    ORDER BY r.score DESC, r.verified_at DESC NULLS LAST, r.title ASC
    LIMIT v_limit;
END;
$$;

-- 6. Grant explicit execution permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.search_normalization(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_portal(TEXT, UUID, INT) TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.search_aliases TO anon, authenticated, service_role;
