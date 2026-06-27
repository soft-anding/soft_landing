-- Migration 0011: Replace RAG embeddings with population tags
-- Drops embedding columns, HNSW indexes, and RPC functions.
-- Adds tags text[] to both tables and populates them from existing data.

-- ── 1. Drop HNSW indexes (must go before dropping the columns) ────────────────
DROP INDEX IF EXISTS idx_rights_items_embedding;
DROP INDEX IF EXISTS idx_moving_tasks_embedding;

-- ── 2. Drop RPC functions ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS match_rights_items(vector, integer, integer);
DROP FUNCTION IF EXISTS match_moving_tasks(vector, integer);

-- ── 3. Drop embedding columns ─────────────────────────────────────────────────
ALTER TABLE rights_items DROP COLUMN IF EXISTS embedding;
ALTER TABLE moving_tasks  DROP COLUMN IF EXISTS embedding;

-- ── 4. Add tags column ────────────────────────────────────────────────────────
ALTER TABLE rights_items ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE moving_tasks  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_rights_items_tags ON rights_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_moving_tasks_tags  ON moving_tasks  USING gin(tags);

-- ── 5. Populate tags — moving_tasks ──────────────────────────────────────────
-- Based on the existing relevance_rule JSONB column.

-- 5a. Tasks with no specific rule → relevant to everyone (all 14 tags)
UPDATE moving_tasks
SET tags = ARRAY[
    'general','student','discharged_soldier','reservist','single_parent',
    'senior_citizen','new_immigrant','disability',
    'has_car','needs_movers',
    'with_family','with_partner','with_roommates','alone'
]
WHERE relevance_rule IS NULL
   OR relevance_rule::text = 'null'
   OR relevance_rule::text = '{}'
   OR relevance_rule::text = '[]';

-- 5b. has_car tasks
UPDATE moving_tasks
SET tags = ARRAY['has_car']
WHERE (relevance_rule ->> 'has_car')::boolean = true;

-- 5c. with_family tasks (also relevant to single parents)
UPDATE moving_tasks
SET tags = ARRAY['with_family','single_parent']
WHERE relevance_rule -> 'moving_companions' @> '["with_family"]'::jsonb;

-- 5d. with_partner tasks
UPDATE moving_tasks
SET tags = array(SELECT DISTINCT unnest(tags || ARRAY['with_partner']))
WHERE relevance_rule -> 'moving_companions' @> '["with_partner"]'::jsonb;

-- 5e. alone tasks
UPDATE moving_tasks
SET tags = ARRAY['alone']
WHERE relevance_rule -> 'moving_companions' @> '["alone"]'::jsonb;

-- 5f. with_roommates tasks
UPDATE moving_tasks
SET tags = ARRAY['with_roommates']
WHERE relevance_rule -> 'moving_companions' @> '["with_roommates"]'::jsonb;

-- 5g. Education tasks → always family-oriented (merge into existing tags)
UPDATE moving_tasks
SET tags = array(SELECT DISTINCT unnest(tags || ARRAY['with_family','single_parent']))
WHERE category = 'education';

-- 5h. Logistics tasks mentioning movers → add needs_movers to existing tags
UPDATE moving_tasks
SET tags = array(SELECT DISTINCT unnest(tags || ARRAY['needs_movers']))
WHERE category = 'logistics'
  AND (title_he ILIKE '%הובל%' OR title_he ILIKE '%מוביל%' OR title_he ILIKE '%הובא%');

-- 5i. Any remaining empty → all tags (safety net)
UPDATE moving_tasks
SET tags = ARRAY[
    'general','student','discharged_soldier','reservist','single_parent',
    'senior_citizen','new_immigrant','disability',
    'has_car','needs_movers',
    'with_family','with_partner','with_roommates','alone'
]
WHERE tags = '{}' OR tags IS NULL;

-- ── 6. Populate tags — rights_items ──────────────────────────────────────────
-- Based on the category column.

-- 6a. General/universal categories → all tags
UPDATE rights_items
SET tags = ARRAY[
    'general','student','discharged_soldier','reservist','single_parent',
    'senior_citizen','new_immigrant','disability',
    'has_car','needs_movers',
    'with_family','with_partner','with_roommates','alone'
]
WHERE category IN ('address_update','arnona_general','rights_general');

-- 6b. Parking permit → car owners only
UPDATE rights_items
SET tags = ARRAY['has_car']
WHERE category = 'parking_permit';

-- 6c. Senior benefits → senior citizens only
UPDATE rights_items
SET tags = ARRAY['senior_citizen']
WHERE category = 'senior_benefits';

-- 6d. Arnona discounts → all eligibility groups except general
--     (these are discounts for specific populations, not for everyone)
UPDATE rights_items
SET tags = ARRAY[
    'student','discharged_soldier','reservist','single_parent',
    'senior_citizen','new_immigrant','disability'
]
WHERE category = 'arnona_discount';

-- 6e. Any remaining empty → all tags (unknown category = show to all)
UPDATE rights_items
SET tags = ARRAY[
    'general','student','discharged_soldier','reservist','single_parent',
    'senior_citizen','new_immigrant','disability',
    'has_car','needs_movers',
    'with_family','with_partner','with_roommates','alone'
]
WHERE tags = '{}' OR tags IS NULL;
