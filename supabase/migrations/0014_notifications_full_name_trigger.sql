-- ============================================================
-- Migration: 0014_notifications_full_name_trigger
-- notifications.full_name (added in 0007_notifications_full_name) was
-- never actually populated — the daily notification job
-- (notification_service.py) doesn't set it on insert. Backfills existing
-- rows from user_profiles.full_name and adds a trigger so future rows
-- get it automatically, mirroring 0012_user_custom_tasks_full_name.sql.
-- ============================================================

UPDATE public.notifications n
SET full_name = p.full_name
FROM public.user_profiles p
WHERE p.id = n.user_id
  AND n.full_name IS DISTINCT FROM p.full_name;

CREATE OR REPLACE FUNCTION public.set_notification_full_name()
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

DROP TRIGGER IF EXISTS trg_notifications_full_name ON public.notifications;
CREATE TRIGGER trg_notifications_full_name
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_full_name();
