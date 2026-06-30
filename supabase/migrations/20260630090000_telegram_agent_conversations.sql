-- One continuous, ever-growing thread per user for the Telegram-side task
-- agent (unlike tasks_agent_conversations, which stores discrete saved
-- sessions from the in-app chat — Telegram has no "end conversation" action,
-- so there's exactly one row per linked user, trimmed by the app layer.

CREATE TABLE telegram_agent_conversations (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at when messages changes
CREATE OR REPLACE FUNCTION _touch_telegram_agent_conversations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.messages IS DISTINCT FROM OLD.messages THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_agent_conversations_messages
  BEFORE UPDATE ON telegram_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION _touch_telegram_agent_conversations();

ALTER TABLE telegram_agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own telegram conversation"
  ON telegram_agent_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
