import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";

const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

// Icon + color per category — frontend-only, mirrors the approach used on
// the Rights & Benefits page. Categories themselves come straight from the
// forms table's real data, not from any reference image.
const CATEGORY_META = {
  "ארנונה":          { icon: "receipt_long",   bg: "bg-amber-100",  text: "text-amber-700" },
  "רשויות מקומיות":  { icon: "account_balance", bg: "bg-purple-100", text: "text-purple-700" },
  "תשתיות":          { icon: "bolt",            bg: "bg-cyan-100",   text: "text-cyan-700" },
  "חוזים":           { icon: "description",     bg: "bg-rose-100",   text: "text-rose-700" },
  other:             { icon: "folder",           bg: "bg-gray-100",   text: "text-gray-600" },
};

function categoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.other;
}

const checkCls = "text-primary border-outline-variant focus:ring-primary focus:ring-2 rounded-sm h-5 w-5 shrink-0 accent-primary cursor-pointer";

// ── Form card — checkbox on the right (first in DOM, lands at the RTL
// start/right), name in the middle, download/external link on the left.
function FormCard({ form, onToggle, saving }) {
  const hasFile = Boolean(form.file_url);

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/30 soft-shadow flex items-center gap-sm p-md min-h-20">
      <input
        type="checkbox"
        className={checkCls}
        checked={form.checked}
        disabled={saving}
        onChange={() => onToggle(form)}
      />

      <div className="flex flex-col gap-xs flex-1 min-w-0 text-right">
        <h4 className={`font-headline-sm text-headline-sm text-on-surface ${form.checked ? "line-through opacity-50" : ""}`}>
          {form.name || "ללא שם"}
        </h4>
        {form.notes && (
          <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">
            {form.notes}
          </p>
        )}
      </div>

      {hasFile ? (
        <a
          href={form.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-xs shrink-0 font-label-sm text-label-sm text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-xl">
            {form.is_external ? "open_in_new" : "download"}
          </span>
        </a>
      ) : (
        <span className="material-symbols-outlined text-xl text-on-surface-variant/30 shrink-0">
          block
        </span>
      )}
    </div>
  );
}

export default function DocumentsForms() {
  const { userProfile } = useAuth();
  const destinationCity = userProfile?.destination_city ?? null;

  const [forms,   setForms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const [search, setSearch]                       = useState("");
  const [activeCategory, setActiveCategory]       = useState("all");
  const [expandedSections, setExpandedSections]   = useState({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.forms(destinationCity)
      .then((data) => { if (alive) setForms(data); })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [destinationCity]);

  async function handleToggle(form) {
    setSaving(true);
    const next = !form.checked;
    setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, checked: next } : f)));
    try {
      await api.setFormChecked(form.id, next);
    } catch (e) {
      setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, checked: form.checked } : f)));
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const cityLabel = CITY_LABELS[destinationCity] || null;

  // Category chips are derived from the full (city-filtered) dataset, not
  // from the search-filtered results, so the chip row stays stable while typing.
  const categoryCounts = new Map();
  for (const form of forms) {
    const cat = form.category || "other";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const categoryList = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  const categoryPillFiltered = activeCategory === "all"
    ? forms
    : forms.filter((f) => (f.category || "other") === activeCategory);

  const searchNeedle = search.trim().toLowerCase();
  const visibleForms = searchNeedle
    ? categoryPillFiltered.filter((f) => (f.name || "").toLowerCase().includes(searchNeedle))
    : categoryPillFiltered;

  const sections = categoryList
    .map((category) => ({
      category,
      items: visibleForms.filter((f) => (f.category || "other") === category),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">

        <section className="mb-lg text-right">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight flex items-center justify-start gap-xs">
            <span className="material-symbols-outlined text-headline-lg">description</span>
            מסמכים וטפסים
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            המסמכים והטפסים הרלוונטיים למעבר שלך — סמנו וי כשמסמך טופל
          </p>
        </section>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md mb-md">
            שגיאה בטעינת הנתונים: {error}
          </div>
        )}

        {!loading && !error && (
          forms.length ? (
            <div>
              {/* Search bar */}
              <div className="relative mb-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש מסמך או טופס..."
                  className="w-full rounded-full border border-outline-variant bg-white pr-12 pl-md py-3 font-body-md text-body-md text-on-surface text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  search
                </span>
              </div>

              {cityLabel && (
                <p className="font-label-md text-label-md text-on-surface-variant mb-md text-right">
                  מוצגים מסמכים רלוונטיים ל{cityLabel}
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
                {categoryList.map((category) => {
                  const meta = categoryMeta(category);
                  const active = activeCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`shrink-0 flex items-center gap-xs px-lg py-sm rounded-full font-label-md text-label-md whitespace-nowrap transition-colors ${
                        active
                          ? "bg-primary text-on-primary"
                          : "border border-outline-variant text-on-surface-variant hover:bg-outline-variant/10"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{meta.icon}</span>
                      {category}
                    </button>
                  );
                })}
              </div>

              {sections.length ? (
                <div className="space-y-md">
                  {sections.map(({ category, items: sectionItems }) => {
                    const meta = categoryMeta(category);
                    const isExpanded = expandedSections[category] || sectionItems.length <= 3;
                    const visibleSectionItems = isExpanded ? sectionItems : sectionItems.slice(0, 3);
                    return (
                      <section key={category}>
                        <div className="flex items-center justify-start gap-sm mb-sm">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg} ${meta.text}`}>
                            <span className="material-symbols-outlined text-2xl">{meta.icon}</span>
                          </span>
                          <h2 className="font-headline-sm text-headline-sm text-on-surface">{category}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
                          {visibleSectionItems.map((form) => (
                            <FormCard key={form.id} form={form} onToggle={handleToggle} saving={saving} />
                          ))}
                        </div>
                        {sectionItems.length > 3 && (
                          <div className="flex justify-center mt-sm">
                            <button
                              onClick={() => setExpandedSections((prev) => ({ ...prev, [category]: !prev[category] }))}
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
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant text-right">
              {!destinationCity
                ? "הוסיפו עיר יעד בפרופיל כדי לראות מסמכים רלוונטיים."
                : "לא נמצאו מסמכים או טפסים רלוונטיים."}
            </p>
          )
        )}
      </main>
    </div>
  );
}
