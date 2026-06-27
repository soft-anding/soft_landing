-- ============================================================
-- Migration: 0008_moving_tasks_timeline
-- Adds timeline_stage to moving_tasks for sequencing tasks
-- relative to move day.
-- ============================================================

ALTER TABLE moving_tasks
  ADD COLUMN IF NOT EXISTS timeline_stage TEXT
  CHECK (timeline_stage IN ('before_move', 'move_day', 'after_move'));
