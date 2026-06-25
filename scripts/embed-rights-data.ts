/**
 * Generates Voyage AI embeddings for any row where embedding IS NULL
 * (i.e. newly cleaned or never embedded).
 *
 * Model: voyage-3 (1024 dimensions — matches vector(1024) in migration 0003)
 * Voyage AI rate limit: 300 RPM / 1M tokens per minute on the free tier.
 * We batch 50 texts per request and add a short delay between batches.
 *
 * Usage:
 *   VOYAGE_API_KEY=... npm run embed:data
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const VOYAGE_MODEL  = 'voyage-3';
const VOYAGE_DIMS   = 1024;
const BATCH_SIZE    = 50;   // texts per API call
const BATCH_DELAY   = 1200; // ms between batches (respects rate limit)

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function buildSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Voyage AI ─────────────────────────────────────────────────────────────────

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Voyage API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  // Return in original order
  const ordered = new Array<number[]>(texts.length);
  for (const item of json.data) {
    ordered[item.index] = item.embedding;
  }

  // Sanity check dimensions
  for (const vec of ordered) {
    if (vec?.length !== VOYAGE_DIMS) {
      throw new Error(`Expected ${VOYAGE_DIMS} dims, got ${vec?.length ?? 'undefined'}`);
    }
  }

  return ordered;
}

// ── Per-table embed ───────────────────────────────────────────────────────────

async function embedTable(
  sb: SupabaseClient,
  table: 'rights_items' | 'moving_tasks',
  apiKey: string,
) {
  log(`\nFetching ${table} rows with NULL embedding…`);

  const { data: rows, error } = await sb
    .from(table)
    .select('id, clean_content')
    .is('embedding', null)
    .not('clean_content', 'is', null);

  if (error) throw new Error(`Fetch error on ${table}: ${error.message}`);
  if (!rows?.length) { log(`  No rows need embedding — skipping.`); return; }

  log(`  ${rows.length} row(s) to embed.`);

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(r => r.clean_content as string);

    try {
      const vectors = await embedBatch(texts, apiKey);

      for (let j = 0; j < batch.length; j++) {
        const { error: upErr } = await sb
          .from(table)
          .update({ embedding: vectors[j] as unknown as string })
          .eq('id', batch[j].id);

        if (upErr) {
          log(`  ✗ id=${batch[j].id}: ${upErr.message}`);
          failed++;
        } else {
          embedded++;
        }
      }

      log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: embedded ${batch.length} rows (total so far: ${embedded})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ✗ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${msg}`);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < rows.length) await sleep(BATCH_DELAY);
  }

  log(`  ${table}: ${embedded} embedded, ${failed} failed.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not set in .env');

  const sb = buildSupabase();

  log(`Using model: ${VOYAGE_MODEL} (${VOYAGE_DIMS} dims)`);

  await embedTable(sb, 'rights_items', apiKey);
  await embedTable(sb, 'moving_tasks', apiKey);

  log('\n✅ Embedding complete.');
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
