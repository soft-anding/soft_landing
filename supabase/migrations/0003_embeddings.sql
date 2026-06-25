-- ============================================================
-- Migration: 0003_embeddings
-- Adds pgvector, clean_content, and embedding columns to
-- rights_items and moving_tasks, plus cosine-search RPC functions.
-- ============================================================

-- pgvector extension (must be enabled before vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Additive columns — rights_items ───────────────────────
ALTER TABLE rights_items
  ADD COLUMN IF NOT EXISTS clean_content TEXT,
  ADD COLUMN IF NOT EXISTS embedding     vector(1024);

-- ── Additive columns — moving_tasks ───────────────────────
ALTER TABLE moving_tasks
  ADD COLUMN IF NOT EXISTS clean_content TEXT,
  ADD COLUMN IF NOT EXISTS embedding     vector(1024);

-- ── HNSW indexes for fast ANN search ──────────────────────
-- (cosine distance — matches the <=> operator used in the RPC)
CREATE INDEX IF NOT EXISTS idx_rights_items_embedding
  ON rights_items USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_moving_tasks_embedding
  ON moving_tasks USING hnsw (embedding vector_cosine_ops);

-- ── RPC: match_rights_items ────────────────────────────────
-- Returns the top-N most similar rights_items to a query embedding,
-- optionally filtered by city_id.
CREATE OR REPLACE FUNCTION match_rights_items(
  query_embedding vector(1024),
  match_city_id   int     DEFAULT NULL,
  match_count     int     DEFAULT 5
)
RETURNS TABLE (
  id            int,
  title_he      text,
  category      text,
  clean_content text,
  source_url    text,
  verified      boolean,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title_he,
    category,
    clean_content,
    source_url,
    verified,
    1 - (embedding <=> query_embedding) AS similarity
  FROM rights_items
  WHERE
    embedding IS NOT NULL
    AND (match_city_id IS NULL OR city_id = match_city_id)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── RPC: match_moving_tasks ────────────────────────────────
-- moving_tasks are city-agnostic, so no city filter.
CREATE OR REPLACE FUNCTION match_moving_tasks(
  query_embedding vector(1024),
  match_count     int DEFAULT 3
)
RETURNS TABLE (
  id            int,
  title_he      text,
  category      text,
  clean_content text,
  source_url    text,
  verified      boolean,
  similarity    float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title_he,
    category,
    clean_content,
    source_url,
    verified,
    1 - (embedding <=> query_embedding) AS similarity
  FROM moving_tasks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Allow authenticated users to call both RPCs (they return only public content)
GRANT EXECUTE ON FUNCTION match_rights_items TO authenticated, anon;
GRANT EXECUTE ON FUNCTION match_moving_tasks TO authenticated, anon;
