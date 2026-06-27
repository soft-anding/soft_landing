-- ============================================================
-- Migration: 0012_user_custom_tasks_full_name
-- Adds full_name to user_custom_tasks, mirroring user_profiles.full_name,
-- so it's visible at a glance in the Table Editor (instead of just
-- the user_id uuid). Backfills existing rows, then keeps new rows in
-- sync automatically via a BEFORE INSERT trigger.
-- ============================================================

ALTER TABLE public.user_custom_tasks
  ADD COLUMN IF NOT EXISTS full_name text;

-- Backfill existing rows from user_profiles.
UPDATE public.user_custom_tasks t
SET full_name = p.full_name
FROM public.user_profiles p
WHERE p.id = t.user_id
  AND t.full_name IS DISTINCT FROM p.full_name;

-- Keep full_name in sync for new rows without requiring app changes.
CREATE OR REPLACE FUNCTION public.set_user_custom_task_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS NULL THEN
    SELECT full_name INTO NEW.full_name
    FROM public.user_profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_custom_tasks_full_name ON public.user_custom_tasks;
CREATE TRIGGER trg_user_custom_tasks_full_name
  BEFORE INSERT ON public.user_custom_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_user_custom_task_full_name();
