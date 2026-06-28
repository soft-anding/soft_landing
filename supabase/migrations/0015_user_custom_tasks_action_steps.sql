-- ============================================================
-- Migration: 0015_user_custom_tasks_action_steps
-- Adds action_steps + related_links to user_custom_tasks, mirroring
-- moving_tasks (0002_moving_tasks.sql), so a custom/agent-added task's
-- detail page can show the same "שלבי פעולה" / "מקורות וקישורים"
-- sections as a built-in task once content exists for them. Both
-- start NULL/empty — nothing populates them yet.
-- ============================================================

ALTER TABLE public.user_custom_tasks
  ADD COLUMN IF NOT EXISTS action_steps jsonb,
  ADD COLUMN IF NOT EXISTS related_links jsonb;
