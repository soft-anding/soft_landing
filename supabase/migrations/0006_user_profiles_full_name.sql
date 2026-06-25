-- ============================================================
-- Migration: 0006_user_profiles_full_name
-- Adds full_name, collected as the first onboarding question.
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name text;
