import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import SideDrawer from "../components/SideDrawer";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { readRightsCache, rightsCacheKey, writeRightsCache } from "../rightsCache";

// ── Hebrew city labels ────────────────────────────────────────────────────────
const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

// ── Info card — collapsed accordion, title always visible ─────────────────────
function InfoCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.summary || item.discount_amount || item.source_url;

  return (
    <div className="bg-white rounded-xl border border-outline-variant/30 soft-shadow text-right flex flex-col min-h-32">
      {/* Header — always visible */}
      <div className="p-md flex justify-between items-start gap-sm">
        <h4 className="font-headline-sm text-headline-sm text-on-surface flex-1 line-clamp-2 min-h-[3rem]">
          {item.title_he || "ללא כותרת"}
        </h4>
        {item.category_label && (
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container/20 text-primary whitespace-nowrap shrink-0">
            {item.category_label}
          </span>
        )}
      </div>

      {/* Accordion toggle */}
      {hasDetails && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-xs w-full px-md pb-md mt-auto font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span>פרטים</span>
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>
      )}

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
  const interestCats     = userProfile?.interest_categories ?? null;

  const cacheKey = rightsCacheKey(destinationCity);
  const cached   = readRightsCache(cacheKey);

  const [items,   setItems]   = useState(cached?.items ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error,   setError]   = useState(null);

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
  const filtered = items.filter((item) => {
    if (!interestCats || interestCats.includes("all")) return true;
    return interestCats.includes(item.category);
  });

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">

        <section className="mb-lg text-right">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight">
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
          filtered.length ? (
            <div>
              {cityLabel && (
                <p className="font-label-md text-label-md text-on-surface-variant mb-md text-right">
                  מוצג מידע רלוונטי ל{cityLabel}
                  {interestCats && !interestCats.includes("all") && " · לפי הנושאים שבחרת"}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
                {filtered.map((item) => (
                  <InfoCard key={`${item.item_type}:${item.item_id}`} item={item} />
                ))}
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
