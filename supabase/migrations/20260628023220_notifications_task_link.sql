-- ============================================================
-- Migration: notifications_task_link
-- Adds the fields the daily notification job needs to link a
-- notification back to its task and to flag overdue ones in red.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS item_type  TEXT CHECK (item_type IN ('moving_task', 'custom_task')),
  ADD COLUMN IF NOT EXISTS item_id    INTEGER,
  ADD COLUMN IF NOT EXISTS task_title TEXT,
  ADD COLUMN IF NOT EXISTS severity   TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('normal', 'urgent'));
