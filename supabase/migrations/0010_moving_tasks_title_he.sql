-- ============================================================
-- Migration: 0010_moving_tasks_title_he
-- Adds title_he column to moving_tasks (was defined in the
-- original schema but missing from the deployed database).
-- ============================================================

ALTER TABLE moving_tasks
  ADD COLUMN IF NOT EXISTS title_he TEXT;
