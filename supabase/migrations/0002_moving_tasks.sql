-- ============================================================
-- Migration: 0002_moving_tasks
-- Project:   soft_landing – pre-move task checklist
-- ============================================================

CREATE TABLE IF NOT EXISTS moving_tasks (
  id             SERIAL PRIMARY KEY,
  source         TEXT NOT NULL,           -- e.g. 'kolzchut_moving_guide'

  title          TEXT,                    -- heading text (may be same as title_he for Hebrew sources)
  title_he       TEXT,

  heading_level  INTEGER,                 -- 2 = top-level H2, 3 = sub-section H3
  parent_title   TEXT,                    -- for H3 headings: the enclosing H2 title; null for H2

  summary        TEXT,                    -- short paraphrased description (1-3 sentences)
  action_steps   JSONB,                   -- array of paraphrased action strings

  related_links  JSONB,                   -- array of {label, url} for official external links

  -- category vocab: government_registry | utilities | municipal |
  --                 communication_services | financial | education | other
  category       TEXT,

  source_url     TEXT,
  scraped_at     TIMESTAMPTZ DEFAULT NOW(),

  -- always false on insert/update — flip manually after reviewing paraphrases
  verified       BOOLEAN DEFAULT FALSE,

  -- (source, title) pair uniquely identifies a heading within a source document
  CONSTRAINT moving_tasks_source_title_unique UNIQUE (source, title)
);

CREATE INDEX IF NOT EXISTS idx_moving_tasks_category ON moving_tasks(category);
CREATE INDEX IF NOT EXISTS idx_moving_tasks_source   ON moving_tasks(source);

-- RLS
ALTER TABLE moving_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read verified moving_tasks"
  ON moving_tasks FOR SELECT
  TO anon, authenticated
  USING (verified = true);
