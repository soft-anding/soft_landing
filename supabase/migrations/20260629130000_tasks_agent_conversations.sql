CREATE TABLE tasks_agent_conversations (
  conversation_id   TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_name TEXT,
  messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            TEXT NOT NULL DEFAULT 'Active'
                      CHECK (status IN ('Active', 'Completed', 'Abandoned')),
  message_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_agent_conversations_user_id
  ON tasks_agent_conversations (user_id);

-- Auto-update last_updated_at when messages changes
CREATE OR REPLACE FUNCTION _touch_tasks_agent_conversations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.messages IS DISTINCT FROM OLD.messages THEN
    NEW.last_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_agent_conversations_messages
  BEFORE UPDATE ON tasks_agent_conversations
  FOR EACH ROW EXECUTE FUNCTION _touch_tasks_agent_conversations();

ALTER TABLE tasks_agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own tasks conversations"
  ON tasks_agent_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
