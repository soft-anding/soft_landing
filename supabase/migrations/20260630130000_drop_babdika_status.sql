-- ============================================================
-- Migration: 20260630130000_drop_babdika_status
-- Removes "בבדיקה" from the fixed statuses, now 5.
-- Existing rows with this status are migrated to "בטיפול".
-- ============================================================

-- Move any existing rows away from the removed status before altering the constraint.
UPDATE user_item_status SET status = 'בטיפול' WHERE status = 'בבדיקה';

ALTER TABLE user_item_status DROP CONSTRAINT IF EXISTS user_item_status_status_check;

ALTER TABLE user_item_status ADD CONSTRAINT user_item_status_status_check
  CHECK (status IN (
    'לא התחיל',
    'בטיפול',
    'הושלם',
    'לא רלוונטי',
    'ממתין לגורם חיצוני'
  ));
