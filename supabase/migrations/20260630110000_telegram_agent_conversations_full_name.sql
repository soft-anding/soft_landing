-- ============================================================
-- Migration: telegram_agent_conversations_full_name
-- Adds full_name to telegram_agent_conversations, mirroring
-- user_profiles.full_name — so it's visible at a glance in the Table
-- Editor (instead of just the user_id uuid), same convention as
-- 0012_user_custom_tasks_full_name.sql / 0007+0014_notifications_full_name.
-- Backfills existing rows, then keeps new rows in sync automatically via
-- a BEFORE INSERT trigger — no app code change needed.
-- ============================================================

ALTER TABLE public.telegram_agent_conversations
  ADD COLUMN IF NOT EXISTS full_name text;

-- Backfill existing rows from user_profiles.
UPDATE public.telegram_agent_conversations t
SET full_name = p.full_name
FROM public.user_profiles p
WHERE p.id = t.user_id
  AND t.full_name IS DISTINCT FROM p.full_name;

-- Keep full_name in sync for new rows without requiring app changes.
CREATE OR REPLACE FUNCTION public.set_telegram_agent_conversation_full_name()
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

DROP TRIGGER IF EXISTS trg_telegram_agent_conversations_full_name ON public.telegram_agent_conversations;
CREATE TRIGGER trg_telegram_agent_conversations_full_name
  BEFORE INSERT ON public.telegram_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_telegram_agent_conversation_full_name();
