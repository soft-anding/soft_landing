-- ============================================================
-- Migration: 0001_initial_schema
-- Project:   soft_landing – municipal rights/benefits pipeline
-- ============================================================

-- ── cities ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cities (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  name_he  TEXT NOT NULL,
  slug     TEXT UNIQUE NOT NULL
);

INSERT INTO cities (name, name_he, slug) VALUES
  ('Jerusalem', 'ירושלים',  'jerusalem'),
  ('Tel Aviv',  'תל אביב', 'tel-aviv')
ON CONFLICT (slug) DO NOTHING;

-- ── rights_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rights_items (
  id                     SERIAL PRIMARY KEY,
  city_id                INTEGER REFERENCES cities(id),

  -- category: e.g. 'arnona_discount', 'arnona_general'
  category               TEXT NOT NULL,

  title                  TEXT,
  title_he               TEXT,
  description            TEXT,

  -- structured lists extracted from the page (Hebrew, verbatim)
  eligibility_conditions JSONB,   -- array of condition strings
  required_documents     JSONB,   -- array of document strings

  discount_amount        TEXT,    -- free text: %, fixed amount, etc.
  deadlines              TEXT,

  source_url             TEXT UNIQUE NOT NULL,
  raw_text               TEXT,

  scraped_at             TIMESTAMPTZ DEFAULT NOW(),

  -- always inserted/updated as false; flipped manually after review
  verified               BOOLEAN DEFAULT FALSE,

  notes                  TEXT
);

CREATE INDEX IF NOT EXISTS idx_rights_items_city_id   ON rights_items(city_id);
CREATE INDEX IF NOT EXISTS idx_rights_items_category  ON rights_items(category);
CREATE INDEX IF NOT EXISTS idx_rights_items_source_url ON rights_items(source_url);

-- ── scrape_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_log (
  id            SERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  status        TEXT CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  scraped_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_log_url    ON scrape_log(url);
CREATE INDEX IF NOT EXISTS idx_scrape_log_status ON scrape_log(status);

-- ── RLS (Row Level Security) ───────────────────────────────
-- Enable RLS on all tables (service_role key bypasses this from the scraper)
ALTER TABLE cities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rights_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_log   ENABLE ROW LEVEL SECURITY;

-- Public read-only access for verified items (the future app reads these)
CREATE POLICY "public can read cities"
  ON cities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public can read verified rights_items"
  ON rights_items FOR SELECT
  TO anon, authenticated
  USING (verified = true);

-- scrape_log is internal only — no public access
