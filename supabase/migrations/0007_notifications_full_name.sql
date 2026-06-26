-- ============================================================
-- Migration: 0007_notifications_full_name
-- Adds full_name to notifications, mirroring user_profiles.full_name.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS full_name text;
