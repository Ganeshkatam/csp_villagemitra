-- ==============================================================================
-- Migration: 20260930010000_create_server_authoritative_search_portal
-- Purpose: Server-Authoritative Global Search Infrastructure (Phase 1 & 2)
-- Architecture: PostgreSQL Native (pg_trgm + full-text search + unified DTO)
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
    SELECT trim(regexp_replace(lower(p_text), '[\s\-_+()/,.:]+', ' ', 'g'));
$$;

-- 3. Trigram and B-Tree Performance Indexes for Searchable Entities
CREATE INDEX IF NOT EXISTS idx_schemes_name_trgm ON public.schemes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_schemes_name_te_trgm ON public.schemes USING gin (name_te gin_trgm_ops) WHERE name_te IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schemes_status_village ON public.schemes(status, village_id);

CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status_village ON public.contacts(status, village_id);

CREATE INDEX IF NOT EXISTS idx_institutions_name_trgm ON public.institutions USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_status_village ON public.institutions(status, village_id, type);

CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON public.businesses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_status_village ON public.businesses(status, village_id);

CREATE INDEX IF NOT EXISTS idx_announcements_title_trgm ON public.announcements USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_announcements_status_village ON public.announcements(status, village_id);

CREATE INDEX IF NOT EXISTS idx_clinical_schedules_role_trgm ON public.clinical_schedules USING gin (doctor_role gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_schedules_status ON public.clinical_schedules(status, village_id);

CREATE INDEX IF NOT EXISTS idx_immunization_schedules_name_trgm ON public.immunization_schedules USING gin (session_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_immunization_schedules_status ON public.immunization_schedules(status, village_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_services_name_trgm ON public.diagnostic_services USING gin (test_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_diagnostic_services_status ON public.diagnostic_services(status, village_id);

-- 4. Unified Server-Authoritative Global Search RPC
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

    RETURN QUERY
    WITH candidates AS (
        -- 1. Schemes
        SELECT 
            'scheme'::TEXT AS entity_type,
            s.id AS entity_id,
            s.name AS title,
            s.name_te AS title_te,
            substring(s.description from 1 for 180) AS subtitle,
            s.category AS category,
            ('/schemes/' || s.id::text) AS url,
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(s.name) = v_norm_q OR (s.name_te IS NOT NULL AND public.search_normalization(s.name_te) = v_norm_q) THEN 1.00
                    WHEN public.search_normalization(s.name) LIKE (v_norm_q || '%') OR (s.name_te IS NOT NULL AND public.search_normalization(s.name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(s.name) LIKE ('%' || v_norm_q || '%') OR (s.name_te IS NOT NULL AND public.search_normalization(s.name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN public.search_normalization(s.category) LIKE ('%' || v_norm_q || '%') THEN 0.60
                    WHEN public.search_normalization(s.description) LIKE ('%' || v_norm_q || '%') THEN 0.40
                    WHEN similarity(s.name, v_clean_q) > 0.25 THEN (0.25 + (similarity(s.name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            s.verified_on AS verified_at,
            NULL::TEXT AS phone
        FROM public.schemes s
        WHERE s.status = 'published'
          AND s.village_id = v_effective_village

        UNION ALL

        -- 2. Emergency & Admin Contacts
        SELECT 
            'contact'::TEXT AS entity_type,
            c.id AS entity_id,
            c.name AS title,
            c.name_te AS title_te,
            COALESCE(c.designation, c.category) AS subtitle,
            c.category AS category,
            ('/contacts/' || lower(replace(c.category, ' ', '-'))) AS url,
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(c.name) = v_norm_q OR (c.name_te IS NOT NULL AND public.search_normalization(c.name_te) = v_norm_q) THEN 1.00
                    WHEN length(v_digits_q) >= 3 AND c.phone IS NOT NULL AND regexp_replace(c.phone, '\D', '', 'g') = v_digits_q THEN 0.95
                    WHEN public.search_normalization(c.name) LIKE (v_norm_q || '%') OR (c.name_te IS NOT NULL AND public.search_normalization(c.name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(c.name) LIKE ('%' || v_norm_q || '%') OR (c.name_te IS NOT NULL AND public.search_normalization(c.name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN length(v_digits_q) >= 3 AND c.phone IS NOT NULL AND regexp_replace(c.phone, '\D', '', 'g') LIKE ('%' || v_digits_q || '%') THEN 0.70
                    WHEN public.search_normalization(c.category) LIKE ('%' || v_norm_q || '%') OR (c.designation IS NOT NULL AND public.search_normalization(c.designation) LIKE ('%' || v_norm_q || '%')) THEN 0.60
                    WHEN similarity(c.name, v_clean_q) > 0.25 THEN (0.25 + (similarity(c.name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            c.verified_on AS verified_at,
            c.phone AS phone
        FROM public.contacts c
        WHERE c.status = 'published'
          AND c.village_id = v_effective_village

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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(i.name) = v_norm_q OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) = v_norm_q) THEN 1.00
                    WHEN v_norm_q IN ('phc', 'health', 'hospital', 'clinic', 'ఆరోగ్య', 'పీహెచ్‌సీ', 'ఆసుపత్రి') THEN 0.90
                    WHEN public.search_normalization(i.name) LIKE (v_norm_q || '%') OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(i.name) LIKE ('%' || v_norm_q || '%') OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN public.search_normalization(i.services) LIKE ('%' || v_norm_q || '%') THEN 0.40
                    WHEN similarity(i.name, v_clean_q) > 0.25 THEN (0.25 + (similarity(i.name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            i.verified_on AS verified_at,
            i.phone AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(i.name) = v_norm_q OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) = v_norm_q) THEN 1.00
                    WHEN v_norm_q IN ('school', 'anganwadi', 'mpps', 'zphs', 'బడి', 'పాఠశాల', 'అంగన్‌వాడీ') THEN 0.90
                    WHEN public.search_normalization(i.name) LIKE (v_norm_q || '%') OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(i.name) LIKE ('%' || v_norm_q || '%') OR (i.name_te IS NOT NULL AND public.search_normalization(i.name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN public.search_normalization(i.services) LIKE ('%' || v_norm_q || '%') THEN 0.40
                    WHEN similarity(i.name, v_clean_q) > 0.25 THEN (0.25 + (similarity(i.name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            i.verified_on AS verified_at,
            i.phone AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(b.name) = v_norm_q OR (b.name_te IS NOT NULL AND public.search_normalization(b.name_te) = v_norm_q) THEN 1.00
                    WHEN public.search_normalization(b.name) LIKE (v_norm_q || '%') OR (b.name_te IS NOT NULL AND public.search_normalization(b.name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(b.name) LIKE ('%' || v_norm_q || '%') OR (b.name_te IS NOT NULL AND public.search_normalization(b.name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN public.search_normalization(b.category) LIKE ('%' || v_norm_q || '%') THEN 0.60
                    WHEN public.search_normalization(b.services) LIKE ('%' || v_norm_q || '%') THEN 0.40
                    WHEN similarity(b.name, v_clean_q) > 0.25 THEN (0.25 + (similarity(b.name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            b.verified_on AS verified_at,
            b.phone AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(a.title) = v_norm_q OR (a.title_te IS NOT NULL AND public.search_normalization(a.title_te) = v_norm_q) THEN 1.00
                    WHEN public.search_normalization(a.title) LIKE (v_norm_q || '%') OR (a.title_te IS NOT NULL AND public.search_normalization(a.title_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(a.title) LIKE ('%' || v_norm_q || '%') OR (a.title_te IS NOT NULL AND public.search_normalization(a.title_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN public.search_normalization(a.category) LIKE ('%' || v_norm_q || '%') THEN 0.60
                    WHEN public.search_normalization(a.description) LIKE ('%' || v_norm_q || '%') THEN 0.40
                    WHEN similarity(a.title, v_clean_q) > 0.25 THEN (0.25 + (similarity(a.title, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            a.verified_on AS verified_at,
            NULL::TEXT AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(cs.doctor_role) = v_norm_q OR (cs.doctor_role_te IS NOT NULL AND public.search_normalization(cs.doctor_role_te) = v_norm_q) THEN 1.00
                    WHEN cs.doctor_name IS NOT NULL AND public.search_normalization(cs.doctor_name) LIKE ('%' || v_norm_q || '%') THEN 0.90
                    WHEN public.search_normalization(cs.doctor_role) LIKE (v_norm_q || '%') OR (cs.doctor_role_te IS NOT NULL AND public.search_normalization(cs.doctor_role_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(cs.doctor_role) LIKE ('%' || v_norm_q || '%') OR (cs.doctor_role_te IS NOT NULL AND public.search_normalization(cs.doctor_role_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN v_norm_q IN ('doctor', 'opd', 'duty', 'clinic', 'డాక్టర్', 'వైద్యులు') THEN 0.70
                    WHEN similarity(cs.doctor_role, v_clean_q) > 0.25 THEN (0.25 + (similarity(cs.doctor_role, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            cs.verified_on AS verified_at,
            NULL::TEXT AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(im.session_name) = v_norm_q OR (im.session_name_te IS NOT NULL AND public.search_normalization(im.session_name_te) = v_norm_q) THEN 1.00
                    WHEN public.search_normalization(im.session_name) LIKE (v_norm_q || '%') OR (im.session_name_te IS NOT NULL AND public.search_normalization(im.session_name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(im.session_name) LIKE ('%' || v_norm_q || '%') OR (im.session_name_te IS NOT NULL AND public.search_normalization(im.session_name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN v_norm_q IN ('vaccine', 'vaccination', 'immunization', 'polio', 'టీకా', 'టీకాలు') THEN 0.70
                    WHEN public.search_normalization(im.vaccines_administered) LIKE ('%' || v_norm_q || '%') THEN 0.50
                    WHEN similarity(im.session_name, v_clean_q) > 0.25 THEN (0.25 + (similarity(im.session_name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            im.verified_on AS verified_at,
            NULL::TEXT AS phone
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
            ROUND(CAST(
                CASE 
                    WHEN public.search_normalization(ds.test_name) = v_norm_q OR (ds.test_name_te IS NOT NULL AND public.search_normalization(ds.test_name_te) = v_norm_q) THEN 1.00
                    WHEN public.search_normalization(ds.test_name) LIKE (v_norm_q || '%') OR (ds.test_name_te IS NOT NULL AND public.search_normalization(ds.test_name_te) LIKE (v_norm_q || '%')) THEN 0.85
                    WHEN public.search_normalization(ds.test_name) LIKE ('%' || v_norm_q || '%') OR (ds.test_name_te IS NOT NULL AND public.search_normalization(ds.test_name_te) LIKE ('%' || v_norm_q || '%')) THEN 0.75
                    WHEN v_norm_q IN ('test', 'lab', 'blood', 'diagnostics', 'పరీక్ష', 'ల్యాబ్', 'రక్త పరీక్ష') THEN 0.70
                    WHEN public.search_normalization(ds.category) LIKE ('%' || v_norm_q || '%') THEN 0.60
                    WHEN similarity(ds.test_name, v_clean_q) > 0.25 THEN (0.25 + (similarity(ds.test_name, v_clean_q) * 0.25))
                    ELSE 0.00
                END AS NUMERIC
            ), 2) AS score,
            ds.verified_on AS verified_at,
            NULL::TEXT AS phone
        FROM public.diagnostic_services ds
        WHERE ds.status = 'published'
          AND ds.village_id = v_effective_village
    )
    SELECT 
        c.entity_type,
        c.entity_id,
        c.title,
        c.title_te,
        c.subtitle,
        c.category,
        c.url,
        c.score,
        c.verified_at,
        c.phone
    FROM candidates c
    WHERE c.score >= 0.25
    ORDER BY c.score DESC, c.verified_at DESC NULLS LAST, c.title ASC
    LIMIT v_limit;
END;
$$;

-- 5. Grant explicit execution permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.search_normalization(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_portal(TEXT, UUID, INT) TO anon, authenticated, service_role;
