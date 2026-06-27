-- ============================================================
-- Migration: 0013_moving_tasks_category_trim
-- Fixes a scraping artifact: one moving_tasks row has
-- "בירוקרטיה ממשלתית   " (trailing whitespace) instead of
-- "בירוקרטיה ממשלתית", which made the Dashboard show it as a
-- separate category card from the other 2 rows with the same
-- (trimmed) category.
-- ============================================================

UPDATE public.moving_tasks
SET category = TRIM(category)
WHERE category IS DISTINCT FROM TRIM(category);
