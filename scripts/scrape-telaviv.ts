import { chromium, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const DELAY_MS   = 1500;
const USER_AGENT =
  'SoftLanding-Research-Bot/1.0 (academic research; contact: mayarashti2002@gmail.com)';

// These domains are JS-rendered — we always need Playwright to get real content.
// tel-aviv.gov.il is SharePoint (server-rendered) but also uses Playwright for
// consistency and because some sub-pages lazy-load content.
const JS_RENDERED_DOMAINS = new Set([
  'www5.tel-aviv.gov.il',
  'holders.tel-aviv.gov.il',
]);

// Seed pages: [url, category, renderHint]
// renderHint: 'static' = SharePoint server-rendered; 'dynamic' = JS-rendered
const SEED_PAGES: Array<{ url: string; category: string; dynamic: boolean; followLinks: boolean }> = [
  {
    url: 'https://www.tel-aviv.gov.il/Residents/Arnona/Pages/Arnona.aspx',
    category: 'arnona_general',
    dynamic: false,
    followLinks: true,
  },
  {
    // Step-1 of discount form — extract category labels only, never submit
    url: 'https://www5.tel-aviv.gov.il/tlvForms/TlvArnonaDiscountRequest/',
    category: 'arnona_discount',
    dynamic: true,
    followLinks: false,
  },
  {
    url: 'https://www.tel-aviv.gov.il/Residents/Transportation/Pages/LocalTav.aspx',
    category: 'parking_permit',
    dynamic: false,
    followLinks: true,
  },
  {
    url: 'https://www.tel-aviv.gov.il/Residents/HealthAndSocial/Pages/RightsAndServices.aspx',
    category: 'rights_general',
    dynamic: false,
    followLinks: true,
  },
  {
    url: 'https://holders.tel-aviv.gov.il/',
    category: 'address_update',
    dynamic: true,
    followLinks: false,
  },
];

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

interface PageRecord {
  url: string;
  category: string;
  op: 'inserted' | 'updated';
  dynamic: boolean; // true = JS-rendered, false = server-rendered (SharePoint)
}

interface Stats {
  pages: number;
  inserted: number;
  updated: number;
  failed: number;
  failedUrls: string[];
  ambiguousUrls: string[];
  pageRecords: PageRecord[];
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
      'Missing env vars — copy .env.example → .env and fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
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
    title_he: item.title_he,
    description: item.description,
    eligibility_conditions: item.eligibility_conditions,
    required_documents: item.required_documents,
    discount_amount: item.discount_amount,
    deadlines: item.deadlines,
    source_url: item.source_url,
    raw_text: item.raw_text,
    scraped_at: new Date().toISOString(),
    verified: false, // always false — manual review required before publishing
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

// ── URL helpers ───────────────────────────────────────────────────────────────

function normalizeUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href.split('#')[0].split('?')[0];
  } catch {
    return '';
  }
}

function isDomainAllowed(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === 'www.tel-aviv.gov.il' || h === 'www5.tel-aviv.gov.il' || h === 'holders.tel-aviv.gov.il';
  } catch {
    return false;
  }
}

// For tel-aviv.gov.il SharePoint pages: follow sub-links under /Residents/ only
// Skip: /Search/, /Lists/, /Pages/Forms/, contact pages, login, etc.
function isSubstantiveTlvLink(url: string, linkText: string, parentCategory: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.tel-aviv.gov.il') return false;
    const p = parsed.pathname;

    // robots.txt disallowed paths
    if (/^\/(Search|Lists|_catalogs|_cts|_private|ReusableContent|WorkflowTasks|SiteCollectionDocuments|SiteCollectionImages|SiteAssets|Documents\/Forms|Pages\/Forms)/i.test(p)) {
      return false;
    }
    // Skip utility pages
    if (/\/(contact|accessibility|sitemap|login|print|status|check|apply|form|submit)/i.test(p)) {
      return false;
    }
    // Must stay under /Residents/
    if (!p.startsWith('/Residents/')) return false;

    // Keep the link relevant to its parent category
    if (parentCategory === 'parking_permit' && !p.includes('Transport')) return false;
    if (parentCategory === 'rights_general' && !p.includes('Health') && !p.includes('Social')) return false;
    if (parentCategory === 'arnona_general' && !p.includes('Arnona')) return false;

    // Skip navigation labels with very short text
    if (linkText.trim().length < 4) return false;
    return true;
  } catch {
    return false;
  }
}

function isDynamic(url: string): boolean {
  try {
    return JS_RENDERED_DOMAINS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// ── Browser fetch ─────────────────────────────────────────────────────────────

async function fetchWithPlaywright(ctx: BrowserContext, url: string): Promise<string> {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });

    const title = await page.title();
    if (/access denied|denied|blocked|captcha/i.test(title)) {
      throw new Error(`Access denied (title: "${title}")`);
    }

    return await page.content();
  } finally {
    await page.close();
  }
}

// For the Tel Aviv discount form: load step 1 and extract visible category labels
// without interacting with any form fields.
async function scrapeDiscountFormStep1(ctx: BrowserContext, url: string): Promise<ScrapedItem> {
  const page: Page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });

    // Extract all visible option labels (radio buttons, selects, list items)
    // The form likely uses radio buttons or a step-list for discount types.
    const html = await page.content();
    const $ = cheerio.load(html);

    // Collect category names from: radio labels, select options, li text, button text
    const categories = new Set<string>();

    // Radio/checkbox labels
    $('label').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 200) categories.add(t);
    });

    // Select options
    $('option').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 2 && t.length < 200 && !/^-+$/.test(t)) categories.add(t);
    });

    // List items that look like category names (not navigation)
    $('ul li, ol li').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 4 && t.length < 150) categories.add(t);
    });

    // Button / card text that lists categories
    $('[class*="category"], [class*="discount"], [class*="type"], [class*="option"]').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 4 && t.length < 150) categories.add(t);
    });

    const eligibilityList = Array.from(categories).filter(c => c.length > 3).slice(0, 50);

    // Raw text of entire page for the fallback
    $('nav, header, footer, script, style, noscript').remove();
    const raw_text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 60_000);

    const title_he =
      $('h1').first().text().trim() ||
      $('h2').first().text().trim() ||
      'בקשת הנחה בארנונה — קטגוריות';

    return {
      category: 'arnona_discount',
      title_he,
      description: 'קטגוריות הנחה בארנונה כפי שמופיעות בשלב 1 של טופס הגשת הבקשה המקוון.',
      eligibility_conditions: eligibilityList.length ? eligibilityList : null,
      required_documents: null,
      discount_amount: null,
      deadlines: null,
      source_url: url,
      raw_text,
    };
  } finally {
    await page.close();
  }
}

// ── Content extraction (shared, identical to Jerusalem scraper) ────────────────

function extractItem(html: string, url: string, category: string): ScrapedItem {
  const $ = cheerio.load(html);

  $(
    'nav, header, footer, .navigation, .nav, .menu, #menu, ' +
    '.breadcrumb, .breadcrumbs, .sidebar, .side-nav, ' +
    '.social, .share-buttons, script, style, noscript, iframe'
  ).remove();

  const contentSelectors = [
    'main', '[role="main"]', 'article', '#content',
    '.content-area', '.page-content', '.inner-content',
    '#main', '.main', 'body',
  ];
  let $main = $('body');
  for (const sel of contentSelectors) {
    if ($(sel).length) { $main = $(sel).first(); break; }
  }

  const title_he =
    $main.find('h1').first().text().trim() ||
    $main.find('h2').first().text().trim() ||
    $('title').text().split('|')[0].trim() ||
    null;

  const raw_text = $main.text().replace(/\s+/g, ' ').trim().slice(0, 60_000);

  function extractListAfterKeyword(keywords: string[]): string[] | null {
    let found: string[] | null = null;
    $main.find('h2, h3, h4, h5, strong, b, p').each((_, el) => {
      const text = $(el).text().trim();
      if (!keywords.some(kw => text.includes(kw))) return;
      let $list = $(el).next('ul, ol');
      if (!$list.length) $list = $(el).nextAll('ul, ol').first();
      if (!$list.length) $list = $(el).parent().next('ul, ol');
      if (!$list.length) $list = $(el).parent().nextAll('ul, ol').first();
      if ($list.length) {
        const items = $list.find('li')
          .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
          .get().filter(s => s.length > 1);
        if (items.length) { found = items; return false; }
      }
    });
    return found;
  }

  const eligibility_conditions = extractListAfterKeyword([
    'תנאי זכאות', 'תנאים לזכאות', 'זכאות', 'מי זכאי', 'זכאי ל', 'הזכאים',
  ]);

  const required_documents = extractListAfterKeyword([
    'מסמכים נדרשים', 'מסמכים', 'תעודות נדרשות', 'יש להגיש', 'להגיש', 'צרף',
  ]);

  let discount_amount: string | null = null;
  const discountSentenceRe = /[^.،؟!]{0,80}(?:הנחה|פטור|זיכוי|הפחתה)[^.،؟!]{0,120}/g;
  for (const s of raw_text.match(discountSentenceRe) ?? []) {
    if (/\d/.test(s)) { discount_amount = s.trim().slice(0, 250); break; }
  }
  if (!discount_amount) {
    const pct = raw_text.match(/\d+(?:\.\d+)?\s*%/);
    if (pct) discount_amount = pct[0];
  }

  let deadlines: string | null = null;
  const deadlineKeywords = [
    'מועד אחרון', 'תאריך הגשה', 'הגשת בקשה', 'עד תאריך',
    'מועד הגשה', 'בכל שנה עד', 'הגשה עד',
  ];
  $main.find('*').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 5 && text.length < 400 && deadlineKeywords.some(kw => text.includes(kw)) && /\d/.test(text)) {
      deadlines = text.slice(0, 350);
      return false;
    }
  });
  if (!deadlines) {
    const m = raw_text.match(/\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}/);
    if (m) {
      const idx = raw_text.indexOf(m[0]);
      deadlines = raw_text.slice(Math.max(0, idx - 60), idx + 120).trim();
    }
  }

  let description: string | null = null;
  $main.find('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 40) { description = text.slice(0, 1000); return false; }
  });

  return { category, title_he, description, eligibility_conditions, required_documents, discount_amount, deadlines, source_url: url, raw_text };
}

// ── Link discovery for tel-aviv.gov.il sub-pages ──────────────────────────────

function discoverTlvSubLinks(html: string, pageUrl: string, parentCategory: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>([pageUrl]);
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const text = $(el).text().trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || href.startsWith('javascript:')) return;

    const full = normalizeUrl(href, pageUrl);
    if (!full || seen.has(full)) return;
    seen.add(full);

    if (isSubstantiveTlvLink(full, text, parentCategory)) {
      log(`  FOLLOW  ${full}  («${text}»)`);
      links.push(full);
    } else {
      log(`  SKIP    ${href}  («${text.slice(0, 40)}»)`);
    }
  });

  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const sb = buildSupabase();

  // Ensure seed data exists (idempotent)
  const { error: seedErr } = await sb.from('cities').upsert(
    [
      { name: 'Jerusalem', name_he: 'ירושלים', slug: 'jerusalem' },
      { name: 'Tel Aviv',  name_he: 'תל אביב',  slug: 'tel-aviv'  },
    ],
    { onConflict: 'slug' }
  );
  if (seedErr) log(`Warning – cities seed: ${seedErr.message}`);

  const { data: city, error: cityErr } = await sb
    .from('cities')
    .select('id')
    .eq('slug', 'tel-aviv')
    .single();

  if (cityErr || !city) {
    throw new Error(
      `Tel Aviv row not found after seeding. Check migration ran + SUPABASE_SERVICE_ROLE_KEY.\n` +
      `Supabase error: ${cityErr?.message ?? 'no row returned'}`
    );
  }
  const cityId: number = city.id;
  log(`Tel Aviv city_id = ${cityId}`);

  const stats: Stats = {
    pages: 0, inserted: 0, updated: 0, failed: 0,
    failedUrls: [], ambiguousUrls: [], pageRecords: [],
  };

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
      'Accept-Language':           'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding':           'gzip, deflate, br',
      'Sec-Ch-Ua':                 '"Chromium";v="124","Google Chrome";v="124","Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile':          '?0',
      'Sec-Ch-Ua-Platform':        '"Windows"',
      'Sec-Fetch-Dest':            'document',
      'Sec-Fetch-Mode':            'navigate',
      'Sec-Fetch-Site':            'none',
      'Sec-Fetch-User':            '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['he-IL', 'he', 'en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({ length: 3, item: () => null, namedItem: () => null, refresh: () => {} }),
    });
  });

  async function scrapeOne(
    url: string,
    category: string,
    dynamic: boolean
  ): Promise<{ html: string; item: ScrapedItem } | null> {
    stats.pages++;
    const renderLabel = dynamic ? 'JS-rendered' : 'server-rendered';
    log(`\nScraping [${renderLabel}]: ${url}`);

    try {
      // Special case: Tel Aviv discount form — extract step-1 categories only
      if (url.includes('TlvArnonaDiscountRequest')) {
        const item = await scrapeDiscountFormStep1(ctx, url);
        if (!item.raw_text || item.raw_text.length < 30) {
          log(`  AMBIGUOUS – very little content extracted`);
          stats.ambiguousUrls.push(url);
        }
        const op = await upsertItem(sb, cityId, item);
        log(`  → ${op}  [${renderLabel}]  (title: ${item.title_he ?? 'n/a'})`);
        if (op === 'inserted') stats.inserted++; else stats.updated++;
        stats.pageRecords.push({ url, category, op, dynamic });
        await logScrape(sb, url, 'success');
        return { html: '', item };
      }

      const html = await fetchWithPlaywright(ctx, url);
      const item = extractItem(html, url, category);

      if (!item.raw_text || item.raw_text.length < 50) {
        log(`  AMBIGUOUS – very little text extracted`);
        stats.ambiguousUrls.push(url);
      }

      const op = await upsertItem(sb, cityId, item);
      log(`  → ${op}  [${renderLabel}]  (title: ${item.title_he ?? 'n/a'})`);
      if (op === 'inserted') stats.inserted++; else stats.updated++;
      stats.pageRecords.push({ url, category, op, dynamic });
      await logScrape(sb, url, 'success');
      return { html, item };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ERROR: ${msg}`);
      await logScrape(sb, url, 'failed', msg);
      stats.failed++;
      stats.failedUrls.push(url);
      return null;
    }
  }

  try {
    for (const seed of SEED_PAGES) {
      await sleep(DELAY_MS);
      console.log(`\n${'='.repeat(60)}`);
      log(`Seed page [${seed.category}]: ${seed.url}`);
      console.log('='.repeat(60));

      const result = await scrapeOne(seed.url, seed.category, seed.dynamic);
      if (!result || !seed.followLinks || !result.html) continue;

      // Discover and follow sub-links for this seed page
      log(`Discovering sub-links for ${seed.category}…`);
      const subLinks = discoverTlvSubLinks(result.html, seed.url, seed.category);
      log(`Found ${subLinks.length} sub-link(s).`);

      for (const subUrl of subLinks) {
        await sleep(DELAY_MS);
        // Determine render method by domain
        const subDynamic = isDynamic(subUrl);
        // Infer category: senior_benefits if under HealthAndSocial
        let subCategory = seed.category;
        if (subUrl.includes('Senior') || subUrl.includes('קשיש') || subUrl.includes('Elder')) {
          subCategory = 'senior_benefits';
        }
        await scrapeOne(subUrl, subCategory, subDynamic);
      }
    }
  } finally {
    await ctx.close();
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE SUMMARY — Tel Aviv');
  console.log('='.repeat(60));
  console.log(`Pages processed : ${stats.pages}`);
  console.log(`Inserted        : ${stats.inserted}`);
  console.log(`Updated         : ${stats.updated}`);
  console.log(`Failed          : ${stats.failed}`);

  // Breakdown by render method
  const dynamic = stats.pageRecords.filter(r => r.dynamic);
  const staticR = stats.pageRecords.filter(r => !r.dynamic);
  console.log(`\nRender method breakdown:`);
  console.log(`  Server-rendered (SharePoint)  : ${staticR.length} page(s)`);
  staticR.forEach(r => console.log(`    ${r.op === 'inserted' ? '+' : '~'}  [${r.category}]  ${r.url}`));
  console.log(`  JS-rendered (SPA/Angular)     : ${dynamic.length} page(s)  ← higher manual-review priority`);
  dynamic.forEach(r => console.log(`    ${r.op === 'inserted' ? '+' : '~'}  [${r.category}]  ${r.url}`));

  if (stats.failedUrls.length) {
    console.log('\nFailed pages (review manually):');
    stats.failedUrls.forEach(u => console.log(`  ✗  ${u}`));
  }
  if (stats.ambiguousUrls.length) {
    console.log('\nAmbiguous pages (little content extracted — verify):');
    stats.ambiguousUrls.forEach(u => console.log(`  ?  ${u}`));
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
