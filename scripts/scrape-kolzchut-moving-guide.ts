/**
 * Scraper: kolzchut.org.il — moving-home guide
 *
 * robots.txt: page is fully allowed; crawl-delay = 10s (single fetch, so one
 * 10-second wait added after the fetch before writing to Supabase, to be polite).
 *
 * Licensing note: kolzchut content is CC BY-NC-SA 2.5 IL (non-commercial).
 * Raw bullet text is used ONLY as input to the paraphrasing step and is never
 * stored. Only paraphrased summaries, action steps, and verbatim external URLs
 * are written to the database.
 */

import * as cheerio from 'cheerio';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_URL   = 'https://www.kolzchut.org.il/he/%D7%9E%D7%93%D7%A8%D7%99%D7%9A_%D7%9C%D7%9E%D7%A2%D7%91%D7%A8_%D7%93%D7%99%D7%A8%D7%94';
const PAGE_TITLE = 'מדריך למעבר דירה';
const SOURCE     = 'kolzchut_moving_guide';
const USER_AGENT = 'SoftLanding-Research-Bot/1.0 (academic research; contact: mayarashti2002@gmail.com)';

// Stop processing content when we hit this H2 (legal sources section)
const STOP_AT_HEADING = 'מקורות משפטיים ורשמיים';

// Skip these headings entirely (navigation, boilerplate)
const SKIP_HEADINGS = new Set(['תפריט נגישות', 'מקורות משפטיים ורשמיים', 'הרחבות ופרסומים']);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  title: string;
  heading_level: 2 | 3;
  parent_title: string | null;
  raw_bullets: string[];          // verbatim text — used only for paraphrasing, never stored
  related_links: Array<{ label: string; url: string }>;
  category: string;
}

interface Paraphrased {
  summary: string;
  action_steps: string[];
}

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Category inference ────────────────────────────────────────────────────────

function inferCategory(title: string): string {
  if (/מרשם|אוכלוסין|ביטוח לאומי/.test(title))          return 'government_registry';
  if (/חשמל|מים|גז/.test(title))                          return 'utilities';
  if (/רשות|רשויות מקומיות/.test(title))                  return 'municipal';
  if (/תקשורת|דואר/.test(title))                          return 'communication_services';
  if (/פיצויי|מס הכנסה|פריפריה/.test(title))             return 'financial';
  if (/חינוך|ילדים|בית ספר|גן/.test(title))              return 'education';
  return 'other';
}

// ── HTML fetch ────────────────────────────────────────────────────────────────

async function fetchPage(): Promise<string> {
  log(`Fetching: ${PAGE_URL}`);
  const resp = await fetch(PAGE_URL, {
    headers: {
      'User-Agent':      USER_AGENT,
      'Accept-Language': 'he-IL,he;q=0.9',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching page`);
  log('Page fetched successfully (static HTML / Varnish-cached).');
  // Respect kolzchut crawl-delay: 10s — polite wait before any further network work
  log('Waiting 10 s (robots.txt Crawl-delay)…');
  await sleep(10_000);
  return resp.text();
}

// ── Section extraction ────────────────────────────────────────────────────────

function extractSections(html: string): Section[] {
  const $ = cheerio.load(html);
  const $content = $('#mw-content-text .mw-parser-output');

  const sections: Section[] = [];
  let current: Section | null = null;
  let currentH2Title: string | null = null;
  let stop = false;

  $content.children().each((_, el) => {
    if (stop) return;

    const tag = (el as cheerio.Element & { tagName?: string }).tagName?.toLowerCase() ?? '';

    if (tag === 'h2') {
      const rawTitle = $(el).find('.mw-headline').text().trim() || $(el).text().trim();
      // Clean MediaWiki's encoded heading text
      const title = rawTitle.replace(/\[\s*edit\s*\]/i, '').trim();

      if (title === STOP_AT_HEADING) { stop = true; return; }
      if (SKIP_HEADINGS.has(title))  { current = null; return; }

      if (current) sections.push(current);
      currentH2Title = title;
      current = {
        title,
        heading_level: 2,
        parent_title: null,
        raw_bullets: [],
        related_links: [],
        category: inferCategory(title),
      };

    } else if (tag === 'h3') {
      const rawTitle = $(el).find('.mw-headline').text().trim() || $(el).text().trim();
      const title = rawTitle.replace(/\[\s*edit\s*\]/i, '').trim();

      if (SKIP_HEADINGS.has(title)) { current = null; return; }

      if (current) sections.push(current);
      current = {
        title,
        heading_level: 3,
        parent_title: currentH2Title,
        raw_bullets: [],
        related_links: [],
        category: inferCategory(title),
      };

    } else if (current) {
      // Collect list items
      if (tag === 'ul' || tag === 'ol') {
        $(el).find('li').each((_, li) => {
          const text = $(li).text().replace(/\s+/g, ' ').trim();
          if (text.length > 3) current!.raw_bullets.push(text);

          $(li).find('a[href]').each((_, a) => {
            const href = $(a).attr('href') ?? '';
            const label = $(a).text().trim();
            if (!href || href.startsWith('#')) return;
            // Only store external URLs (gov.il, btl, etc.) — not kolzchut internal links
            if (href.startsWith('/he/') || href.startsWith('/ar/') || href.startsWith('/ru/')) return;
            const url = href.startsWith('http') ? href : `https://www.kolzchut.org.il${href}`;
            if (label.length > 2) {
              current!.related_links.push({ label, url });
            }
          });
        });

      } else if (tag === 'p') {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length > 10) current!.raw_bullets.push(text);

        $(el).find('a[href]').each((_, a) => {
          const href = $(a).attr('href') ?? '';
          const label = $(a).text().trim();
          if (!href || href.startsWith('#')) return;
          if (href.startsWith('/he/') || href.startsWith('/ar/') || href.startsWith('/ru/')) return;
          const url = href.startsWith('http') ? href : `https://www.kolzchut.org.il${href}`;
          if (label.length > 2) {
            current!.related_links.push({ label, url });
          }
        });
      }
    }
  });

  if (current && !stop) sections.push(current);

  // Deduplicate related_links within each section
  for (const s of sections) {
    const seen = new Set<string>();
    s.related_links = s.related_links.filter(l => {
      const key = l.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return sections;
}

// ── Paraphrasing via Claude API (optional) ────────────────────────────────────
// If ANTHROPIC_API_KEY is set: paraphrase all sections in one batch call.
// If not: store raw bullet points directly and prefix summary with [RAW] so
//         every row is clearly flagged for manual rewriting before verified=true.

async function paraphraseSections(sections: Section[]): Promise<Paraphrased[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log('ANTHROPIC_API_KEY not set — storing raw content. Every row will be prefixed [RAW] in summary.');
    return sections.map(s => ({
      summary:
        '[RAW — rewrite before publishing] ' +
        (s.raw_bullets[0] ?? s.title).slice(0, 300),
      action_steps: s.raw_bullets.slice(0, 10),
    }));
  }

  const anthropic = new Anthropic({ apiKey });
  log(`Calling Claude API to paraphrase ${sections.length} section(s) in one batch…`);

  const sectionInput = sections.map((s, i) => ({
    index: i,
    title: s.title,
    heading_level: s.heading_level,
    raw_content: s.raw_bullets.join(' | '),
  }));

  const prompt = `You are paraphrasing Hebrew content from a moving-home guide for Israeli residents (source: kolzchut.org.il, CC BY-NC-SA licensed).

Rules:
- Write entirely in Hebrew.
- Do NOT copy any source sentence verbatim — paraphrase in your own words.
- "summary": 1–3 sentence plain-language paraphrase of what this task/topic involves.
- "action_steps": 2–6 short, actionable items in imperative voice describing what the person needs to do.
- Keep it practical and factual; do not add information not present in the raw content.

Input sections (JSON):
${JSON.stringify(sectionInput, null, 2)}

Return ONLY a valid JSON array of objects in the same order as the input, each with exactly these keys:
{"summary": "...", "action_steps": ["...", "..."]}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    log('Raw Claude response:\n' + text.slice(0, 500));
    throw new Error('Claude did not return a valid JSON array');
  }

  const parsed: Paraphrased[] = JSON.parse(jsonMatch[0]);
  if (parsed.length !== sections.length) {
    throw new Error(`Claude returned ${parsed.length} items but expected ${sections.length}`);
  }

  log('Paraphrasing complete.');
  return parsed;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function buildSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertTask(
  sb: SupabaseClient,
  section: Section,
  paraphrased: Paraphrased
): Promise<'inserted' | 'updated'> {
  const payload = {
    source:         SOURCE,
    title_he:       section.title,
    heading_level:  section.heading_level,
    parent_title:   section.parent_title,
    summary:        paraphrased.summary,
    action_steps:   paraphrased.action_steps,
    related_links:  section.related_links.length ? section.related_links : null,
    category:       section.category,
    source_url:     PAGE_URL,
    scraped_at:     new Date().toISOString(),
    verified:       false,
  };

  const { data: existing } = await sb
    .from('moving_tasks')
    .select('id')
    .eq('source', SOURCE)
    .eq('title_he', section.title)
    .maybeSingle();

  if (existing) {
    const { error } = await sb
      .from('moving_tasks')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return 'updated';
  } else {
    const { error } = await sb.from('moving_tasks').insert(payload);
    if (error) throw error;
    return 'inserted';
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sb = buildSupabase();

  // ── 1. Fetch ──
  const html = await fetchPage();

  // ── 2. Extract structure ──
  const sections = extractSections(html);

  log(`Extracted ${sections.length} heading(s).`);

  // ── 3. Print title list for visual review BEFORE upserting ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EXTRACTED TITLES FROM: ${PAGE_TITLE}`);
  console.log('='.repeat(60));
  let lastH2 = '';
  for (const s of sections) {
    const indent = s.heading_level === 2 ? '' : '  ';
    const parent = s.parent_title && s.parent_title !== lastH2
      ? ` (under: ${s.parent_title})`
      : '';
    console.log(`${indent}[H${s.heading_level}] [${s.category}] ${s.title}${parent}`);
    if (s.heading_level === 2) lastH2 = s.title;
    console.log(`${indent}       links: ${s.related_links.length}  bullets: ${s.raw_bullets.length}`);
  }
  console.log('');

  // ── 4. Paraphrase all sections via Claude API ──
  const paraphrased = await paraphraseSections(sections);

  // ── 5. Upsert to Supabase ──
  log(`Upserting ${sections.length} rows to moving_tasks…`);
  let inserted = 0, updated = 0, failed = 0;
  const failedTitles: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const p = paraphrased[i];
    try {
      const op = await upsertTask(sb, s, p);
      log(`  ${op === 'inserted' ? '+' : '~'}  [H${s.heading_level}] ${s.title}`);
      if (op === 'inserted') inserted++; else updated++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ✗  [H${s.heading_level}] ${s.title}  — ${msg}`);
      failed++;
      failedTitles.push(s.title);
    }
  }

  // ── 6. Summary ──
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE SUMMARY — kolzchut moving guide');
  console.log('='.repeat(60));
  console.log(`Source page  : ${PAGE_TITLE}`);
  console.log(`Render method: static HTML (Varnish-cached MediaWiki) — cheerio only, no Playwright`);
  console.log(`Headings found  : ${sections.length}  (${sections.filter(s => s.heading_level === 2).length} H2,  ${sections.filter(s => s.heading_level === 3).length} H3)`);
  console.log(`Inserted        : ${inserted}`);
  console.log(`Updated         : ${updated}`);
  console.log(`Failed          : ${failed}`);

  if (failedTitles.length) {
    console.log('\nFailed rows:');
    failedTitles.forEach(t => console.log(`  ✗  ${t}`));
  }

  const usedApi = !!process.env.ANTHROPIC_API_KEY;
  console.log(`
⚠️  MANUAL REVIEW REQUIRED before setting verified=true:
   • Mode: ${usedApi ? 'paraphrased via Claude API' : 'RAW content stored — summary/action_steps need rewriting (CC BY-NC-SA)'}
   • Confirm category assignments are correct for your use case.
   • Verify that related_links point to the correct official services.
   ${!usedApi ? '• All summary fields start with [RAW] — rewrite them before publishing.' : ''}
`);
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
