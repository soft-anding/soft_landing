-- ============================================================
-- Migration: 0005_user_profiles_v2
-- • Drops rental_or_buy, contract_signed, phone_number columns.
-- • Adds a check constraint on origin_city (same values as
--   destination_city: jerusalem | tel_aviv).
--
-- SAFETY: A guard block runs first and aborts the migration if
-- any existing row has data in the dropped columns, or has an
-- origin_city value that won't fit the new constraint.
-- ============================================================

DO $$
DECLARE
  dropped_data_count  integer;
  bad_origin_count    integer;
BEGIN
  -- 1. Check for non-null values in the columns being dropped.
  SELECT COUNT(*) INTO dropped_data_count
  FROM public.user_profiles
  WHERE rental_or_buy   IS NOT NULL
     OR contract_signed IS NOT NULL
     OR phone_number    IS NOT NULL;

  IF dropped_data_count > 0 THEN
    RAISE EXCEPTION
      'STOP: % row(s) in user_profiles contain data in columns about to be '
      'dropped (rental_or_buy, contract_signed, phone_number). '
      'Inspect, back up, or clear them before re-running this migration.',
      dropped_data_count;
  END IF;

  -- 2. Check for origin_city values that would violate the new constraint.
  SELECT COUNT(*) INTO bad_origin_count
  FROM public.user_profiles
  WHERE origin_city IS NOT NULL
    AND origin_city NOT IN ('jerusalem', 'tel_aviv');

  IF bad_origin_count > 0 THEN
    RAISE EXCEPTION
      'STOP: % row(s) have origin_city values not in (jerusalem, tel_aviv). '
      'Update or set them to NULL before re-running this migration.',
      bad_origin_count;
  END IF;
END $$;

-- ── Drop removed columns ────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS rental_or_buy,
  DROP COLUMN IF EXISTS contract_signed,
  DROP COLUMN IF EXISTS phone_number;

-- ── Add check constraint on origin_city ────────────────────────────────────

-- Drop in case a prior partial run left it.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_origin_city_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_origin_city_check
  CHECK (origin_city IS NULL OR origin_city IN ('jerusalem', 'tel_aviv'));
