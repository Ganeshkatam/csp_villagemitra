-- ==============================================================================
-- Migration: 20260928170226_phase_0_security_hardening
-- Resolves Supabase Security Advisor lints:
-- 1. Lint 0010: view_survey_metric_counts converted to security_invoker = true
-- 2. Lint 0011: Public functions pinned with immutable search_path = public, pg_temp
-- 3. Lint 0028: create_admin_user and get_admin_users revoked from anon and PUBLIC
-- 4. Admin Users RLS: auth.uid() subquery evaluation optimization
-- ==============================================================================

ALTER VIEW public.view_survey_metric_counts
  SET (security_invoker = true);

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_admin',
        'get_survey_analytics_summary',
        'get_admin_users',
        'create_admin_user',
        'check_feedback_status',
        'set_citizen_feedback_reference_id'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      r.schema_name, r.function_name, r.identity_args
    );
  END LOOP;
END
$$;

REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Users read own admin profile" ON public.admin_users;
CREATE POLICY "Users read own admin profile"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Public read villages" ON public.villages;
