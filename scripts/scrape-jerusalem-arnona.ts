import { chromium, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL  = 'https://www.jerusalem.muni.il';
const HUB_URL   = `${BASE_URL}/he/residents/arnona/arnonadiscounts/apartments/`;
const ANNUAL_URL = `${BASE_URL}/he/residents/arnona/annual-arnona/`;
const DELAY_MS  = 1500;
const USER_AGENT =
  'SoftLanding-Research-Bot/1.0 (academic research; contact: mayarashti2002@gmail.com)';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScrapedItem {
  category: string;
  title_he: string | null;
  description: string | null;
  eligibility_conditions: string[] | null;
  required_documents: string[] | null;
  discount_amount: string | null;
  deadlines: string | null;
  source_url: string;
  raw_text: string;
}

interface Stats {
  pages: number;
  inserted: number;
  updated: number;
  failed: number;
  skipped: number;
  failedUrls: string[];
  ambiguousUrls: string[];
}

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function buildSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing env vars. Copy .env.example → .env and fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function logScrape(
  sb: SupabaseClient,
  url: string,
  status: 'success' | 'failed' | 'skipped',
  error_message?: string
) {
  await sb.from('scrape_log').insert({
    url,
    status,
    error_message: error_message ?? null,
    scraped_at: new Date().toISOString(),
  });
}

async function upsertItem(
  sb: SupabaseClient,
  cityId: number,
  item: ScrapedItem
): Promise<'inserted' | 'updated'> {
  const { data: existing } = await sb
    .from('rights_items')
    .select('id')
    .eq('source_url', item.source_url)
    .maybeSingle();

  const payload = {
    city_id: cityId,
    category: item.category,
    title: item.title_he,        // both columns get the Hebrew title for now
    title_he: item.title_he,
    description: item.description,
    eligibility_conditions: item.eligibility_conditions,
    required_documents: item.required_documents,
    discount_amount: item.discount_amount,
    deadlines: item.deadlines,
    source_url: item.source_url,
    raw_text: item.raw_text,
    scraped_at: new Date().toISOString(),
    verified: false,             // always reset on update – manual review required
  };

  if (existing) {
    const { error } = await sb
      .from('rights_items')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
    return 'updated';
  } else {
    const { error } = await sb.from('rights_items').insert(payload);
    if (error) throw error;
    return 'inserted';
  }
}

// ── Link filtering ────────────────────────────────────────────────────────────

function normalizeUrl(href: string): string {
  if (href.startsWith('http')) return href.split('#')[0].split('?')[0];
  return (BASE_URL + (href.startsWith('/') ? href : '/' + href))
    .split('#')[0]
    .split('?')[0];
}

// Returns true for arnona discount sub-pages we should follow from the hub
function isDiscountSubPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.jerusalem.muni.il') return false;
    const p = parsed.pathname;
    // Must be under /arnona/ and not the hub page itself
    if (!p.includes('/arnona/')) return false;
    if (p.endsWith('/arnonadiscounts/apartments/')) return false;
    // Skip utility pages
    if (/\/(contact|search|news|accessibility|sitemap|login|print)/i.test(p)) return false;
    return true;
  } catch {
    return false;
  }
}

// Returns true for substantive annual-arnona sub-links worth following
function isSubstantiveAnnualLink(url: string, linkText: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.jerusalem.muni.il') return false;
    const p = parsed.pathname;
    // Must be an arnona-related path, not contact/form/news
    if (!p.includes('/arnona/')) return false;
    if (/\/(contact|search|news|form|accessibility|sitemap|login|print)/i.test(p)) return false;
    // Skip very short / generic link texts (navigation labels)
    const trimmed = linkText.trim();
    if (trimmed.length < 4) return false;
    return true;
  } catch {
    return false;
  }
}

// ── HTML → page fetch ─────────────────────────────────────────────────────────

async function fetchPage(ctx: BrowserContext, url: string): Promise<string> {
  const page = await ctx.newPage();
  try {
    // 'networkidle' gives Akamai's JS challenge time to run and redirect
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });

    // If we landed on an Access Denied / challenge page, bail early
    const title = await page.title();
    if (/access denied|denied|blocked|captcha/i.test(title)) {
      throw new Error(`Access denied by server (page title: "${title}")`);
    }

    return await page.content();
  } finally {
    await page.close();
  }
}

// ── Content extraction ────────────────────────────────────────────────────────

function extractItem(html: string, url: string, category: string): ScrapedItem {
  const $ = cheerio.load(html);

  // Strip chrome that isn't body content
  $(
    'nav, header, footer, .navigation, .nav, .menu, #menu, ' +
    '.breadcrumb, .breadcrumbs, .sidebar, .side-nav, ' +
    '.social, .share-buttons, script, style, noscript, iframe'
  ).remove();

  // Find the main content area (try progressively broader selectors)
  const contentSelectors = [
    'main',
    '[role="main"]',
    'article',
    '#content',
    '.content-area',
    '.page-content',
    '.inner-content',
    '#main',
    '.main',
    'body',
  ];
  let $main = $('body');
  for (const sel of contentSelectors) {
    if ($(sel).length) {
      $main = $(sel).first();
      break;
    }
  }

  // ── Title ──
  const title_he =
    $main.find('h1').first().text().trim() ||
    $main.find('h2').first().text().trim() ||
    $('title').text().split('|')[0].trim() ||
    null;

  // ── Raw text (capped at 60 000 chars – PostgREST limit is well above this) ──
  const raw_text = $main.text().replace(/\s+/g, ' ').trim().slice(0, 60_000);

  // ── Helper: find list items following a heading that contains a keyword ──
  function extractListAfterKeyword(keywords: string[]): string[] | null {
    let found: string[] | null = null;

    $main.find('h2, h3, h4, h5, strong, b, p').each((_, el) => {
      const text = $(el).text().trim();
      if (!keywords.some(kw => text.includes(kw))) return;

      // Try immediate next sibling list
      let $list = $(el).next('ul, ol');
      if (!$list.length) $list = $(el).nextAll('ul, ol').first();
      // One level up
      if (!$list.length) $list = $(el).parent().next('ul, ol');
      if (!$list.length) $list = $(el).parent().nextAll('ul, ol').first();

      if ($list.length) {
        const items = $list
          .find('li')
          .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
          .get()
          .filter(s => s.length > 1);
        if (items.length) {
          found = items;
          return false; // break each()
        }
      }
    });

    return found;
  }

  // ── Eligibility conditions ──
  const eligibility_conditions = extractListAfterKeyword([
    'תנאי זכאות', 'תנאים לזכאות', 'זכאות', 'מי זכאי', 'זכאי ל', 'הזכאים'
  ]);

  // ── Required documents ──
  const required_documents = extractListAfterKeyword([
    'מסמכים נדרשים', 'מסמכים', 'תעודות נדרשות', 'יש להגיש', 'להגיש', 'צרף'
  ]);

  // ── Discount amount ──
  // Look for a sentence containing "הנחה" / "פטור" / "זיכוי" with a number near it
  let discount_amount: string | null = null;
  const discountSentenceRe = /[^.،؟!]{0,80}(?:הנחה|פטור|זיכוי|הפחתה)[^.،؟!]{0,120}/g;
  const sentences = raw_text.match(discountSentenceRe) ?? [];
  for (const s of sentences) {
    if (/\d/.test(s)) {
      discount_amount = s.trim().slice(0, 250);
      break;
    }
  }
  // Fallback: grab first standalone percentage
  if (!discount_amount) {
    const pct = raw_text.match(/\d+(?:\.\d+)?\s*%/);
    if (pct) discount_amount = pct[0];
  }

  // ── Deadlines ──
  let deadlines: string | null = null;
  const deadlineKeywords = [
    'מועד אחרון', 'תאריך הגשה', 'הגשת בקשה', 'עד תאריך',
    'מועד הגשה', 'בכל שנה עד', 'הגשה עד',
  ];
  $main.find('*').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (
      text.length > 5 &&
      text.length < 400 &&
      deadlineKeywords.some(kw => text.includes(kw)) &&
      /\d/.test(text)
    ) {
      deadlines = text.slice(0, 350);
      return false; // break
    }
  });
  // Fallback: first DD/MM/YYYY date in context
  if (!deadlines) {
    const dateRe = /\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}/;
    const m = raw_text.match(dateRe);
    if (m) {
      const idx = raw_text.indexOf(m[0]);
      deadlines = raw_text.slice(Math.max(0, idx - 60), idx + 120).trim();
    }
  }

  // ── Description – first substantive paragraph ──
  let description: string | null = null;
  $main.find('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 40) {
      description = text.slice(0, 1000);
      return false;
    }
  });

  return {
    category,
    title_he,
    description,
    eligibility_conditions,
    required_documents,
    discount_amount,
    deadlines,
    source_url: url,
    raw_text,
  };
}

// ── Link discovery ────────────────────────────────────────────────────────────

function discoverDiscountLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return;
    }
    const full = normalizeUrl(href);
    if (seen.has(full)) return;
    seen.add(full);

    if (isDiscountSubPage(full)) {
      log(`  FOLLOW  ${full}`);
      links.push(full);
    } else {
      log(`  SKIP    ${href}`);
    }
  });

  return links;
}

function discoverAnnualSubLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return;
    }
    const full = normalizeUrl(href);
    if (seen.has(full) || full === ANNUAL_URL) return;
    seen.add(full);

    if (isSubstantiveAnnualLink(full, text)) {
      log(`  FOLLOW  ${full}  («${text}»)`);
      links.push(full);
    } else {
      log(`  SKIP    ${href}  («${text}»)`);
    }
  });

  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sb = buildSupabase();

  // Seed cities if missing (idempotent — safe to run every time)
  const { error: seedErr } = await sb.from('cities').upsert(
    [
      { name: 'Jerusalem', name_he: 'ירושלים', slug: 'jerusalem' },
      { name: 'Tel Aviv',  name_he: 'תל אביב',  slug: 'tel-aviv'   },
    ],
    { onConflict: 'slug' }
  );
  if (seedErr) {
    // Non-fatal: cities might already exist; log and continue
    log(`Warning: cities upsert returned an error: ${seedErr.message}`);
  }

  // Resolve Jerusalem city ID
  const { data: city, error: cityErr } = await sb
    .from('cities')
    .select('id')
    .eq('slug', 'jerusalem')
    .single();

  if (cityErr || !city) {
    // Throw instead of process.exit() to avoid the Windows UV_HANDLE_CLOSING crash
    throw new Error(
      `Jerusalem row still not found after seeding. ` +
      `Check that the migration ran and that SUPABASE_SERVICE_ROLE_KEY is correct.\n` +
      `Supabase error: ${cityErr?.message ?? 'no row returned'}`
    );
  }
  const cityId: number = city.id;

  const stats: Stats = {
    pages: 0, inserted: 0, updated: 0, failed: 0, skipped: 0,
    failedUrls: [], ambiguousUrls: [],
  };

  // Akamai bot-detection bypass:
  // – disable Chrome's AutomationControlled flag (sets navigator.webdriver = true)
  // – use a real-looking Chrome UA + sec-ch-ua hints that match it
  // – headless: false so the browser presents a real display pipeline fingerprint
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'he-IL',
    extraHTTPHeaders: {
      'Accept-Language':          'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept':                   'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding':          'gzip, deflate, br',
      'Sec-Ch-Ua':                '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile':         '?0',
      'Sec-Ch-Ua-Platform':       '"Windows"',
      'Sec-Fetch-Dest':           'document',
      'Sec-Fetch-Mode':           'navigate',
      'Sec-Fetch-Site':           'none',
      'Sec-Fetch-User':           '?1',
      'Upgrade-Insecure-Requests':'1',
    },
  });

  // Patch navigator.webdriver so JS on the page cannot detect automation
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['he-IL', 'he', 'en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({ length: 3, item: () => null, namedItem: () => null, refresh: () => {} }),
    });
  });

  try {
    // ── 1. Hub page: discover discount sub-pages ─────────────────────────────
    log(`\n${'='.repeat(60)}`);
    log(`Crawling hub: ${HUB_URL}`);
    log('='.repeat(60));

    let discountLinks: string[] = [];
    let hubHtml = '';
    try {
      hubHtml = await fetchPage(ctx, HUB_URL);
      log('Discovering links from hub page…');
      discountLinks = discoverDiscountLinks(hubHtml);
      log(`Found ${discountLinks.length} discount sub-page(s) to scrape.`);
      await logScrape(sb, HUB_URL, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`ERROR loading hub page: ${msg}`);
      await logScrape(sb, HUB_URL, 'failed', msg);
      stats.failed++;
      stats.failedUrls.push(HUB_URL);
    }

    // Also scrape the hub page itself as a general-info item
    if (hubHtml) {
      try {
        stats.pages++;
        const item = extractItem(hubHtml, HUB_URL, 'arnona_discount');
        const op = await upsertItem(sb, cityId, item);
        log(`Hub page → ${op}  (${HUB_URL})`);
        if (op === 'inserted') stats.inserted++;
        else stats.updated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`ERROR upserting hub page: ${msg}`);
      }
    }

    // ── 2. Discount sub-pages ────────────────────────────────────────────────
    for (const url of discountLinks) {
      await sleep(DELAY_MS);
      log(`\nScraping: ${url}`);
      stats.pages++;

      try {
        const html = await fetchPage(ctx, url);
        const item = extractItem(html, url, 'arnona_discount');

        if (!item.raw_text || item.raw_text.length < 50) {
          log(`  AMBIGUOUS – very little text extracted`);
          stats.ambiguousUrls.push(url);
        }

        const op = await upsertItem(sb, cityId, item);
        log(`  → ${op}  (title: ${item.title_he ?? 'n/a'})`);
        if (op === 'inserted') stats.inserted++;
        else stats.updated++;

        await logScrape(sb, url, 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERROR: ${msg}`);
        await logScrape(sb, url, 'failed', msg);
        stats.failed++;
        stats.failedUrls.push(url);
      }
    }

    // ── 3. Annual arnona page ────────────────────────────────────────────────
    await sleep(DELAY_MS);
    log(`\n${'='.repeat(60)}`);
    log(`Crawling annual page: ${ANNUAL_URL}`);
    log('='.repeat(60));

    let annualLinks: string[] = [];
    let annualHtml = '';
    try {
      annualHtml = await fetchPage(ctx, ANNUAL_URL);
      stats.pages++;

      const item = extractItem(annualHtml, ANNUAL_URL, 'arnona_general');
      const op = await upsertItem(sb, cityId, item);
      log(`Annual page → ${op}  (title: ${item.title_he ?? 'n/a'})`);
      if (op === 'inserted') stats.inserted++;
      else stats.updated++;

      await logScrape(sb, ANNUAL_URL, 'success');

      log('Discovering substantive sub-links from annual page…');
      annualLinks = discoverAnnualSubLinks(annualHtml);
      log(`Found ${annualLinks.length} sub-link(s) to follow.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`ERROR loading annual page: ${msg}`);
      await logScrape(sb, ANNUAL_URL, 'failed', msg);
      stats.failed++;
      stats.failedUrls.push(ANNUAL_URL);
    }

    // ── 4. Annual sub-pages ───────────────────────────────────────────────────
    for (const url of annualLinks) {
      await sleep(DELAY_MS);
      log(`\nScraping annual sub-page: ${url}`);
      stats.pages++;

      try {
        const html = await fetchPage(ctx, url);
        const item = extractItem(html, url, 'arnona_general');

        if (!item.raw_text || item.raw_text.length < 50) {
          log(`  AMBIGUOUS – very little text extracted`);
          stats.ambiguousUrls.push(url);
        }

        const op = await upsertItem(sb, cityId, item);
        log(`  → ${op}  (title: ${item.title_he ?? 'n/a'})`);
        if (op === 'inserted') stats.inserted++;
        else stats.updated++;

        await logScrape(sb, url, 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERROR: ${msg}`);
        await logScrape(sb, url, 'failed', msg);
        stats.failed++;
        stats.failedUrls.push(url);
      }
    }
  } finally {
    await ctx.close();
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Pages processed : ${stats.pages}`);
  console.log(`Inserted        : ${stats.inserted}`);
  console.log(`Updated         : ${stats.updated}`);
  console.log(`Failed          : ${stats.failed}`);
  console.log(`Skipped         : ${stats.skipped}`);

  if (stats.failedUrls.length) {
    console.log('\nFailed pages (review manually):');
    stats.failedUrls.forEach(u => console.log(`  ✗  ${u}`));
  }
  if (stats.ambiguousUrls.length) {
    console.log('\nAmbiguous pages (little content extracted – verify):');
    stats.ambiguousUrls.forEach(u => console.log(`  ?  ${u}`));
  }
  console.log('');
}

// Use process.exitCode instead of process.exit() to avoid the Windows
// UV_HANDLE_CLOSING assertion that fires when async handles are still open.
main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
