import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import ShrinkToFitTitle from "../components/ShrinkToFitTitle";
import SideDrawer from "../components/SideDrawer";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { readRightsCache, rightsCacheKey, writeRightsCache } from "../rightsCache";

// ── Hebrew city labels ────────────────────────────────────────────────────────
const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

// ── Icon + color per category slug — frontend-only (no icon field on the
// data itself). The theme's own pastel tokens (primary/secondary/tertiary/
// error containers) only span 4 hues — not enough for 6+ categories without
// repeats — so this uses Tailwind's default palette (still available
// alongside the theme's `extend`-ed tokens) to give every category a
// genuinely distinct hue. Icon-name choices mirror CategoryCard.jsx.
const CATEGORY_META = {
  rights_general:   { icon: "gavel",         bg: "bg-purple-100",  text: "text-purple-700" },
  arnona_general:   { icon: "receipt_long",  bg: "bg-indigo-100",  text: "text-indigo-700" },
  arnona_discount:  { icon: "savings",       bg: "bg-amber-100",   text: "text-amber-700" },
  parking_permit:   { icon: "local_parking", bg: "bg-cyan-100",    text: "text-cyan-700" },
  senior_benefits:  { icon: "elderly",       bg: "bg-rose-100",    text: "text-rose-700" },
  "חינוך":          { icon: "school",        bg: "bg-green-100",   text: "text-green-700" },
  other:            { icon: "category",      bg: "bg-gray-100",    text: "text-gray-600" },
};

function categoryMeta(slug) {
  return CATEGORY_META[slug] || CATEGORY_META.other;
}

// ── Info card — icon avatar centered on the right, full details in a drawer
function InfoCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.summary || item.discount_amount || item.source_url;
  const meta = categoryMeta(item.category);

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/30 soft-shadow text-right flex items-center gap-sm p-md min-h-32">
      <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
        <span className="material-symbols-outlined text-2xl">{meta.icon}</span>
      </span>

      <div className="flex flex-col gap-xs flex-1 min-w-0">
        <ShrinkToFitTitle
          as="h4"
          text={item.title_he || "ללא כותרת"}
          lines={1}
          className="font-headline-sm font-semibold text-on-surface"
        />

        {item.summary && (
          <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Accordion toggle */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-xs w-full mt-xs font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            <span>לפרטים</span>
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
        )}
      </div>

      {/* Details drawer (slides in from the side instead of pushing content down) */}
      <SideDrawer
        open={expanded}
        onClose={() => setExpanded(false)}
        title={item.title_he || "פרטים"}
      >
        <div className="space-y-sm">
          {item.summary && (
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {item.summary}
            </p>
          )}
          {item.discount_amount && (
            <p className="font-label-md text-label-md text-primary">
              הטבה: {item.discount_amount}
            </p>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label-md text-label-md text-primary inline-flex items-center gap-xs hover:underline"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              למקור המידע
            </a>
          )}
        </div>
      </SideDrawer>
    </div>
  );
}

// ── Rights & Benefits page ─────────────────────────────────────────────────────
export default function RightsBenefits() {
  const { userProfile } = useAuth();

  const destinationCity = userProfile?.destination_city ?? null;

  const cacheKey = rightsCacheKey(destinationCity);
  const cached   = readRightsCache(cacheKey);

  const [items,   setItems]   = useState(cached?.items ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error,   setError]   = useState(null);

  const [search, setSearch]               = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    let alive = true;
    function load(showSpinner) {
      if (showSpinner) setLoading(true);
      api.items({ type: "rights_item", city: destinationCity })
        .then((data) => {
          if (!alive) return;
          setItems(data);
          writeRightsCache(cacheKey, { items: data });
        })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && showSpinner && setLoading(false));
    }
    // AppHeader already prefetches this in the background from every
    // authenticated page, so cacheKey is usually warm by the time this
    // page mounts — this still refetches fresh data every mount, just
    // silently when there's something cached to show meanwhile.
    load(!readRightsCache(cacheKey));
    return () => { alive = false; };
  }, [destinationCity]);

  const cityLabel = CITY_LABELS[destinationCity] || null;

  // Backend already filters by interest_categories + tags; no client-side pass needed.
  const interestFiltered = items;

  // Category chips are derived from interestFiltered (NOT from the
  // search-filtered results below), so the chip row stays stable while
  // typing — only the sections shrink as search narrows things down.
  const categoryCounts = new Map();
  for (const item of interestFiltered) {
    const slug = item.category || "other";
    categoryCounts.set(slug, (categoryCounts.get(slug) || 0) + 1);
  }
  const categoryList = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => ({
      slug,
      label: interestFiltered.find((i) => (i.category || "other") === slug)?.category_label || slug,
    }));

  // Stage 2: selected category chip.
  const categoryPillFiltered = activeCategory === "all"
    ? interestFiltered
    : interestFiltered.filter((item) => (item.category || "other") === activeCategory);

  // Stage 3: free-text search.
  const searchNeedle = search.trim().toLowerCase();
  const visibleItems = searchNeedle
    ? categoryPillFiltered.filter((item) => {
        const haystack = `${item.title_he} ${item.summary || ""}`.toLowerCase();
        return haystack.includes(searchNeedle);
      })
    : categoryPillFiltered;

  // Group what's left into sections, in the same order as the chip row.
  const sections = categoryList
    .map(({ slug, label }) => ({
      slug,
      label,
      items: visibleItems.filter((item) => (item.category || "other") === slug),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">

        <section className="mb-lg text-right">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight flex items-center justify-start gap-xs">
            <span className="material-symbols-outlined text-headline-lg">workspace_premium</span>
            זכויות והטבות
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            מידע על זכויות, הנחות והטבות הרלוונטיות למעבר שלך
          </p>
        </section>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md mb-md">
            שגיאה בטעינת הנתונים: {error}
          </div>
        )}

        {!loading && !error && (
          interestFiltered.length ? (
            <div>
              {/* Search bar */}
              <div className="relative mb-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חפשו הטבות, זכויות או שירותים שרלוונטיים אליכם..."
                  className="w-full rounded-full border border-outline-variant bg-white pr-12 pl-md py-3 font-body-md text-body-md text-on-surface text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  search
                </span>
              </div>

              {cityLabel && (
                <p className="font-label-md text-label-md text-on-surface-variant mb-md text-right">
                  מוצג מידע רלוונטי ל{cityLabel}
                </p>
              )}

              {/* Category filter chips */}
              <div className="flex gap-sm overflow-x-auto pb-sm mb-md -mx-1 px-1">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`shrink-0 flex items-center gap-xs px-lg py-sm rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                    activeCategory === "all"
                      ? "bg-primary text-on-primary"
                      : "border border-outline-variant text-on-surface-variant hover:bg-outline-variant/10"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">apps</span>
                  הכל
                </button>
                {categoryList.map(({ slug, label }) => {
                  const meta = categoryMeta(slug);
                  const active = activeCategory === slug;
                  return (
                    <button
                      key={slug}
                      onClick={() => setActiveCategory(slug)}
                      className={`shrink-0 flex items-center gap-xs px-lg py-sm rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                        active
                          ? "bg-primary text-on-primary"
                          : "border border-outline-variant text-on-surface-variant hover:bg-outline-variant/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{meta.icon}</span>
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Sections, or "filters matched nothing" empty state */}
              {sections.length ? (
                <div className="space-y-md">
                  {sections.map(({ slug, label, items: sectionItems }) => {
                    const meta = categoryMeta(slug);
                    const isExpanded = expandedSections[slug] || sectionItems.length <= 3;
                    const visibleSectionItems = isExpanded ? sectionItems : sectionItems.slice(0, 3);
                    return (
                      <section key={slug}>
                        <div className="flex items-center justify-start gap-sm mb-sm">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
                            <span className="material-symbols-outlined text-2xl">{meta.icon}</span>
                          </span>
                          <h2 className="font-headline-sm text-headline-sm text-on-surface">{label}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
                          {visibleSectionItems.map((item) => (
                            <InfoCard key={`${item.item_type}:${item.item_id}`} item={item} />
                          ))}
                        </div>
                        {sectionItems.length > 3 && (
                          <div className="flex justify-center mt-sm">
                            <button
                              onClick={() => setExpandedSections((prev) => ({ ...prev, [slug]: !prev[slug] }))}
                              className="flex items-center gap-xs font-label-md text-label-md text-primary hover:underline"
                            >
                              {isExpanded ? "הסתר" : "הצג עוד"}
                              <span className="material-symbols-outlined text-base">
                                {isExpanded ? "expand_less" : "expand_more"}
                              </span>
                            </button>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="font-body-md text-body-md text-on-surface-variant text-right py-lg">
                  לא נמצאו תוצאות תואמות לחיפוש או לקטגוריה שנבחרה.
                </p>
              )}

              {/* Closing tip box */}
              <div className="mt-xl bg-primary-container/10 rounded-2xl p-md flex items-start gap-sm text-right">
                <span className="material-symbols-outlined text-primary">tips_and_updates</span>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  לא בטוחים מאיפה להתחיל? היעזרו בחיפוש או בחרו נושא שמעניין אתכם כדי למצוא את הזכויות וההטבות שמגיעות לכם.
                </p>
              </div>
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant text-right">
              {!destinationCity
                ? "הוסיפו עיר יעד בפרופיל כדי לראות מידע רלוונטי."
                : "לא נמצא מידע מתאים להעדפות שלך."}
            </p>
          )
        )}
      </main>
    </div>
  );
}
