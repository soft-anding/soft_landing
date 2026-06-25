/**
 * Builds and stores a clean_content field for every rights_item and
 * moving_task by combining the structured columns we already extracted.
 *
 * raw_text is intentionally NOT used — it contains nav/footer boilerplate.
 *
 * On each run:
 *   • Updates clean_content on every row.
 *   • Nulls out the embedding column so embed-rights-data.ts re-embeds changed rows.
 *   • Is fully idempotent — safe to run repeatedly.
 *
 * Usage:
 *   npm run clean:data
 *
 * First run prints 3 sample clean_content blocks for each table so you can
 * verify the format before embedding.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Try root .env first, then backend/.env as fallback (monorepo layout).
dotenv.config();
dotenv.config({ path: 'backend/.env' });

// ── Supabase ──────────────────────────────────────────────────────────────────

function buildSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Category label (mirrors backend/app/constants.py) ─────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  government_registry:  'ממשל וכתובת רשמית',
  municipal:            'עירייה',
  utilities:            'חשבונות וספקי שירות',
  communication_services: 'תקשורת: אינטרנט וטלוויזיה',
  financial:            'כספים ותשלומים',
  other:                'כללי',
  rights_general:       'זכויות כלליות',
  arnona_general:       'ארנונה',
  arnona_discount:      'הנחות בארנונה',
  parking_permit:       'תו חניה אזורי',
  senior_benefits:      'הטבות לאזרחים ותיקים',
  address_update:       'עדכון כתובת',
  education:            'חינוך',
};

function catLabel(slug: string | null): string {
  return slug ? (CATEGORY_LABELS[slug] ?? slug) : 'כללי';
}

// ── Clean content builders ────────────────────────────────────────────────────

function buildRightsContent(row: Record<string, unknown>): string {
  const parts: string[] = [];

  const title = (row.title_he as string | null) || (row.title as string | null);
  if (title) parts.push(title);
  parts.push(`קטגוריה: ${catLabel(row.category as string | null)}`);
  parts.push('');

  if (row.description) parts.push(row.description as string);

  const conditions = row.eligibility_conditions as string[] | null;
  if (conditions?.length) {
    parts.push('');
    parts.push('תנאי זכאות:');
    conditions.forEach(c => parts.push(`• ${c}`));
  }

  const docs = row.required_documents as string[] | null;
  if (docs?.length) {
    parts.push('');
    parts.push('מסמכים נדרשים:');
    docs.forEach(d => parts.push(`• ${d}`));
  }

  if (row.discount_amount) {
    parts.push('');
    parts.push(`הנחה/זכות: ${row.discount_amount}`);
  }

  if (row.deadlines) {
    parts.push(`מועדים: ${row.deadlines}`);
  }

  return parts.join('\n').trim();
}

function buildTaskContent(row: Record<string, unknown>): string {
  const parts: string[] = [];

  const title = (row.title_he as string | null) || (row.title as string | null);
  const parent = row.parent_title as string | null;
  const headingCtx = parent ? `${title} (חלק מ: ${parent})` : title;
  if (headingCtx) parts.push(headingCtx);
  parts.push(`קטגוריה: ${catLabel(row.category as string | null)}`);
  parts.push('');

  if (row.summary) parts.push(row.summary as string);

  const steps = row.action_steps as string[] | null;
  if (steps?.length) {
    parts.push('');
    parts.push('שלבי ביצוע:');
    steps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  }

  return parts.join('\n').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processTable(
  sb: SupabaseClient,
  table: 'rights_items' | 'moving_tasks',
  columns: string,
  builder: (row: Record<string, unknown>) => string,
  previewCount: number
) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Processing ${table}…`);

  const { data: rows, error } = await sb.from(table).select(columns);
  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
  if (!rows?.length) { console.log('  No rows found.'); return; }

  console.log(`  ${rows.length} row(s) found.`);

  // ── Print samples before writing ──
  console.log(`\n  SAMPLE clean_content (first ${previewCount} rows):`);
  for (const row of rows.slice(0, previewCount)) {
    const content = builder(row as Record<string, unknown>);
    console.log('\n' + '·'.repeat(50));
    console.log(content.slice(0, 600) + (content.length > 600 ? '\n…[truncated]' : ''));
  }
  console.log('\n' + '·'.repeat(50));

  // ── Upsert clean_content + null out embedding ──
  let updated = 0;
  for (const row of rows as Record<string, unknown>[]) {
    const clean_content = builder(row);
    const { error: upErr } = await sb
      .from(table)
      .update({ clean_content, embedding: null })
      .eq('id', row.id as number);
    if (upErr) {
      console.error(`  ✗ id=${row.id}: ${upErr.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\n  ✓ ${updated}/${rows.length} rows updated (embedding nulled for re-embed).`);
}

async function main() {
  const sb = buildSupabase();

  await processTable(
    sb,
    'rights_items',
    'id,title,title_he,category,description,eligibility_conditions,required_documents,discount_amount,deadlines',
    buildRightsContent,
    3
  );

  await processTable(
    sb,
    'moving_tasks',
    'id,title,title_he,category,parent_title,summary,action_steps',
    buildTaskContent,
    3
  );

  console.log('\n✅ Done. Review samples above, then run: npm run embed:data\n');
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
