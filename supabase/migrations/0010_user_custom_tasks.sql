-- ============================================================
-- Migration: 0010_user_custom_tasks
-- Adds user_custom_tasks table (BIGSERIAL id so it slots into
-- the existing item_type + item_id integer pattern in
-- user_item_status without any structural changes to that table).
-- Extends user_item_status.item_type CHECK to allow 'custom_task'.
-- ============================================================

-- ── user_custom_tasks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_custom_tasks (
  id            BIGSERIAL PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  category      text,
  deadline_type text NOT NULL CHECK (deadline_type IN (
                  'before_move', 'move_day', 'after_move', 'specific_date')),
  deadline_date date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_custom_tasks_user_id
  ON public.user_custom_tasks (user_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.user_custom_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_custom_tasks TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_custom_tasks_id_seq TO authenticated;

CREATE POLICY "users select own custom tasks"
  ON public.user_custom_tasks FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "users insert own custom tasks"
  ON public.user_custom_tasks FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "users update own custom tasks"
  ON public.user_custom_tasks FOR UPDATE
  TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "users delete own custom tasks"
  ON public.user_custom_tasks FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── Extend user_item_status.item_type to allow 'custom_task' ──
-- Safe: existing rows all have item_type IN ('moving_task','rights_item'),
-- which still satisfy the new constraint.
ALTER TABLE public.user_item_status
  DROP CONSTRAINT IF EXISTS user_item_status_item_type_check;

ALTER TABLE public.user_item_status
  ADD CONSTRAINT user_item_status_item_type_check
    CHECK (item_type IN ('moving_task', 'rights_item', 'custom_task'));
