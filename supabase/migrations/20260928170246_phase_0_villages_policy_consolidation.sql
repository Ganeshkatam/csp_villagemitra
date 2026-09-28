-- ==============================================================================
-- Migration: 20260928170246_phase_0_villages_policy_consolidation
-- Resolves multiple permissive policies on public.villages table
-- Replaces single ALL policy with explicit INSERT, UPDATE, and DELETE policies
-- protected by is_admin() server-side check.
-- ==============================================================================

DROP POLICY IF EXISTS "Admin manage villages" ON public.villages;

CREATE POLICY "Admin insert villages"
  ON public.villages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin update villages"
  ON public.villages
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin delete villages"
  ON public.villages
  FOR DELETE
  TO authenticated
  USING (is_admin());
