-- ============================================================
-- Migration: rights_items_category_cleanup
-- 9 rows were added directly to rights_items (via scripts/load_static_rights.py)
-- each with its own one-off English category slug instead of reusing an
-- existing one, causing raw English text to leak into the Hebrew "topics of
-- interest" selector (constants.CATEGORY_LABELS has no entry for them).
-- Reassigns each to the closest existing Hebrew-labeled category instead of
-- introducing new ones — the existing set is enough.
-- ============================================================

UPDATE public.rights_items
SET category = 'arnona_discount'
WHERE category IN ('arnona_exemption_soldiers', 'arnona_discount_student', 'arnona_discount_civic_service');

UPDATE public.rights_items
SET category = 'rights_general'
WHERE category IN (
  'disability_housing_guide',
  'reservist_benefits_guide',
  'youth_housing_guide',
  'rent_assistance_exceptions_committee',
  'lone_soldier_housing_assistance',
  'lone_soldier_electricity_discount'
);
