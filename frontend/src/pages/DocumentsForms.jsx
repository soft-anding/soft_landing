import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import DocumentsAgentChat from "../components/DocumentsAgentChat";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { formsCacheKey, readFormsCache, writeFormsCache } from "../formsCache";

const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

// Icon per category — frontend-only. Categories themselves come straight
// from the forms table's real data, not from any reference image. All
// icons share one color (the site's primary green, same as the header
// title) instead of a different hue per category.
const CATEGORY_ICON = {
  "ארנונה":          "receipt_long",
  "רשויות מקומיות":  "account_balance",
  "תשתיות":          "bolt",
  "חוזים":           "description",
  other:             "folder",
};

function categoryIcon(category) {
  return CATEGORY_ICON[category] || CATEGORY_ICON.other;
}

const checkCls = "text-primary border-outline-variant focus:ring-primary focus:ring-2 rounded-sm h-4 w-4 shrink-0 accent-primary cursor-pointer";

// ── Form row — checkbox on the right (first in DOM, lands at the RTL
// start/right), name + notes in the middle, download/external link on the left.
// min-h keeps every row the same height whether or not it has a notes line.
function FormRow({ form, onToggle, saving }) {
  const hasFile = Boolean(form.file_url);

  return (
    <div className="flex items-center gap-sm px-md py-sm min-h-16">
      <input
        type="checkbox"
        className={checkCls}
        checked={form.checked}
        disabled={saving}
        onChange={() => onToggle(form)}
      />

      <div className="flex flex-col gap-xs flex-1 min-w-0 text-right justify-center">
        <h4 className={`font-body-md text-body-md font-semibold text-on-surface ${form.checked ? "line-through opacity-50" : ""}`}>
          {form.name || "ללא שם"}
        </h4>
        {form.notes && (
          <p className="font-label-sm text-label-sm text-on-surface-variant">
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

// ── Category accordion row — icon + name + checked/total badge on the
// right, "שאלו את הצ'אט" button + chevron on the left.
function CategorySection({ category, items, expanded, onToggleExpand, onToggleForm, saving, onOpenChat }) {
  const icon = categoryIcon(category);
  const checkedCount = items.filter((f) => f.checked).length;

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/30 soft-shadow overflow-hidden">
      <div
        onClick={onToggleExpand}
        className="flex items-center justify-between px-md py-4 cursor-pointer hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-center gap-sm">
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-primary-container/30 text-primary">
            <span className="material-symbols-outlined text-xl">{icon}</span>
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{category}</h2>
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low rounded-full px-sm py-xs">
            {checkedCount}/{items.length}
          </span>
        </div>

        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenChat(category, items); }}
            className="flex items-center gap-xs px-md py-xs rounded-full border border-outline-variant text-on-surface-variant font-label-sm text-label-sm hover:bg-outline-variant/10 transition-colors"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            שאלו את הצ'אט
          </button>
          <span className="material-symbols-outlined text-on-surface-variant">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-outline-variant/10 border-t border-outline-variant/10">
          {items.map((form) => (
            <FormRow key={form.id} form={form} onToggle={onToggleForm} saving={saving} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentsForms() {
  const { userProfile } = useAuth();
  const destinationCity = userProfile?.destination_city ?? null;

  const cacheKey = formsCacheKey(destinationCity);
  const cached   = readFormsCache(cacheKey);

  const [forms,   setForms]   = useState(cached?.forms ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const [expandedSections, setExpandedSections] = useState({});

  const [chatOpen, setChatOpen] = useState(false);
  const [chatCategory, setChatCategory] = useState(null);
  const [chatForms, setChatForms] = useState([]);

  function handleOpenChat(category, items) {
    setChatCategory(category);
    setChatForms(items);
    setChatOpen(true);
  }

  useEffect(() => {
    let alive = true;
    function load(showSpinner) {
      if (showSpinner) setLoading(true);
      api.forms(destinationCity)
        .then((data) => {
          if (!alive) return;
          setForms(data);
          writeFormsCache(cacheKey, { forms: data });
        })
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && showSpinner && setLoading(false));
    }
    // AppHeader already prefetches this in the background from every
    // authenticated page, so cacheKey is usually warm by the time this
    // page mounts — this still refetches fresh data every mount, just
    // silently when there's something cached to show meanwhile.
    load(!readFormsCache(cacheKey));
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

  const categoryCounts = new Map();
  for (const form of forms) {
    const cat = form.category || "other";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const categoryList = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  const sections = categoryList.map((category) => ({
    category,
    items: forms.filter((f) => (f.category || "other") === category),
  }));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <DocumentsAgentChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        category={chatCategory}
        forms={chatForms}
      />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">

        <section className="mb-lg text-right">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight flex items-center justify-start gap-xs">
            <span className="material-symbols-outlined text-headline-lg">description</span>
            מסמכים וטפסים
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            המסמכים והטפסים הרלוונטיים למעבר שלך - סמנו וי כשמסמך טופל
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
              {cityLabel && (
                <p className="font-label-md text-label-md text-on-surface-variant mb-md text-right">
                  מוצגים מסמכים רלוונטיים ל{cityLabel}
                </p>
              )}

              <div className="space-y-sm">
                {sections.map(({ category, items }) => (
                  <CategorySection
                    key={category}
                    category={category}
                    items={items}
                    expanded={!!expandedSections[category]}
                    onToggleExpand={() => setExpandedSections((prev) => ({ ...prev, [category]: !prev[category] }))}
                    onToggleForm={handleToggle}
                    saving={saving}
                    onOpenChat={handleOpenChat}
                  />
                ))}
              </div>
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
