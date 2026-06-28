-- ============================================================
-- Migration: 20260628140000_create_user_form_status
-- Project:   soft_landing – per-user "checked" tracking for the forms table
-- The `forms` table itself already exists live in Supabase (created
-- outside version control) with columns: id, name, category, file_url,
-- created_at, city_id, is_external, notes. This migration only adds the
-- per-user checkbox-state table on top of it, mirroring user_item_status.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_form_status (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  checked    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Denormalized from user_profiles.full_name, mirroring
  -- 0012_user_custom_tasks_full_name.sql / 0014_notifications_full_name_trigger.sql,
  -- so the user is visible at a glance in the Table Editor instead of just user_id.
  full_name  TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, form_id)
);

CREATE INDEX IF NOT EXISTS idx_user_form_status_user_id
  ON user_form_status(user_id);

ALTER TABLE user_form_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own form status"
  ON user_form_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own form status"
  ON user_form_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own form status"
  ON user_form_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own form status"
  ON user_form_status FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_form_status_updated ON user_form_status;
CREATE TRIGGER trg_user_form_status_updated
  BEFORE UPDATE ON user_form_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-fill full_name from user_profiles on insert, same pattern as the
-- other full_name triggers in this project.
CREATE OR REPLACE FUNCTION public.set_user_form_status_full_name()
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

DROP TRIGGER IF EXISTS trg_user_form_status_full_name ON user_form_status;
CREATE TRIGGER trg_user_form_status_full_name
  BEFORE INSERT ON user_form_status
  FOR EACH ROW EXECUTE FUNCTION public.set_user_form_status_full_name();
