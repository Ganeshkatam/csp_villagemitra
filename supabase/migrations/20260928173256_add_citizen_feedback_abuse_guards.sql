-- ==============================================================================
-- Migration: 20260928173256_add_citizen_feedback_abuse_guards
-- Purpose: Add message content boundary constraint to prevent spam/abuse on citizen_feedback.
-- ==============================================================================

ALTER TABLE public.citizen_feedback
  DROP CONSTRAINT IF EXISTS chk_citizen_feedback_message_length;

ALTER TABLE public.citizen_feedback
  ADD CONSTRAINT chk_citizen_feedback_message_length
  CHECK (length(trim(message)) >= 10 AND length(message) <= 2000);
