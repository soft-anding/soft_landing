-- ============================================================
-- Migration: 0009_moving_tasks_personalization
-- Adds relevance_rule and is_niche to moving_tasks for
-- personalized task filtering based on user profile.
-- ============================================================

ALTER TABLE moving_tasks
  ADD COLUMN IF NOT EXISTS relevance_rule JSONB,
  ADD COLUMN IF NOT EXISTS is_niche       BOOLEAN DEFAULT false;
