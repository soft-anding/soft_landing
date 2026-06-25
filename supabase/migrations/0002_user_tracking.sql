-- ============================================================
-- Migration: 0002_user_tracking
-- Project:   soft_landing – per-user progress tracking + auth profiles
-- Adds personal data on top of the shared (scraped) knowledge base.
-- Nothing about the existing cities / rights_items / moving_tasks
-- tables changes.
-- ============================================================

-- ── profiles ──────────────────────────────────────────────
-- One row per authenticated user. Auto-created on sign-up via a
-- trigger that copies the Google display name + email.
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- A user may read / update only their own profile row.
CREATE POLICY "users read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create the profile row when a new auth user is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- This runs only from the trigger above; do not expose it via the REST RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- ── user_item_status ──────────────────────────────────────
-- Per-user status / notes for a single knowledge-base item.
-- item_type tells which catalog table item_id points at.
CREATE TABLE IF NOT EXISTS user_item_status (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  item_type   TEXT NOT NULL CHECK (item_type IN ('moving_task', 'rights_item')),
  item_id     INTEGER NOT NULL,

  -- Only the 7 fixed statuses from the spec (§5) are allowed.
  status      TEXT NOT NULL DEFAULT 'לא התחיל'
              CHECK (status IN (
                'לא התחיל',
                'בבדיקה',
                'בטיפול',
                'הושלם',
                'לא רלוונטי',
                'דורש בדיקה',
                'ממתין לגורם חיצוני'
              )),

  notes       TEXT,
  next_action TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_item_status_user_id
  ON user_item_status(user_id);

ALTER TABLE user_item_status ENABLE ROW LEVEL SECURITY;

-- A user may see / change only their own status rows.
CREATE POLICY "users read own status"
  ON user_item_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own status"
  ON user_item_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own status"
  ON user_item_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own status"
  ON user_item_status FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep updated_at fresh on every change.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_item_status_updated ON user_item_status;
CREATE TRIGGER trg_user_item_status_updated
  BEFORE UPDATE ON user_item_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
