-- ============================================================
-- Migration: 20260628130000_drop_requires_review_status
-- Removes "דורש בדיקה" from the 7 fixed statuses (spec §5), now 6.
-- No live rows used this status at the time of this migration.
-- ============================================================

ALTER TABLE user_item_status DROP CONSTRAINT IF EXISTS user_item_status_status_check;

ALTER TABLE user_item_status ADD CONSTRAINT user_item_status_status_check
  CHECK (status IN (
    'לא התחיל',
    'בבדיקה',
    'בטיפול',
    'הושלם',
    'לא רלוונטי',
    'ממתין לגורם חיצוני'
  ));
