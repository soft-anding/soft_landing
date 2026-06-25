-- ============================================================
-- Migration: 0004_user_profiles
-- Detailed onboarding profile collected once per user.
-- Separate from `profiles` (display name / email, auto-created
-- on signup) so the onboarding form remains optional until filled.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  origin_city         text,
  destination_city    text CHECK (destination_city IN ('jerusalem', 'tel_aviv')),
  move_date           date,
  birth_year          int,

  marital_status      text CHECK (marital_status IN (
                        'single','in_relationship','married','divorced','widowed')),

  moving_companions   text CHECK (moving_companions IN (
                        'alone','with_roommates','with_partner','with_family')),

  occupation          text CHECK (occupation IN (
                        'employee','self_employed','student','unemployed','other')),

  income_range        text CHECK (income_range IN (
                        'under_6000','6000_10000','10000_15000',
                        '15000_20000','over_20000','prefer_not_to_say')),

  has_car             boolean,
  rental_or_buy       text CHECK (rental_or_buy IN ('renting','buying')),
  contract_signed     boolean,
  needs_movers        boolean,
  phone_number        text,

  -- Array of eligibility tags, e.g. ["student","reservist"]
  special_eligibility jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Array of category slugs, or ["all"] to mean every category
  interest_categories jsonb NOT NULL DEFAULT '["all"]'::jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Row-level security ─────────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Breaking change (Apr 28 2026): new tables are no longer auto-exposed to the
-- Data API. Explicit GRANTs required.
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;

CREATE POLICY "users select own user_profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "users insert own user_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- UPDATE needs both USING (which rows) and WITH CHECK (what values are allowed).
CREATE POLICY "users update own user_profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING  ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ── Auto-update updated_at ─────────────────────────────────────────────────
-- Reuses touch_updated_at() defined in migration 0002_user_tracking.

DROP TRIGGER IF EXISTS trg_user_profiles_updated ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
