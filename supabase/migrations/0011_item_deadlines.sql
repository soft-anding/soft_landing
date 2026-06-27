-- ============================================================
-- Migration: 0011_item_deadlines
-- Adds deadline_type and deadline_date to user_item_status so
-- any task type (moving_task, rights_item, custom_task) can
-- carry a user-chosen deadline independent of its catalog entry.
-- ============================================================

ALTER TABLE public.user_item_status
  ADD COLUMN IF NOT EXISTS deadline_type TEXT
    CHECK (deadline_type IN ('before_move', 'move_day', 'after_move', 'specific_date')),
  ADD COLUMN IF NOT EXISTS deadline_date DATE;
