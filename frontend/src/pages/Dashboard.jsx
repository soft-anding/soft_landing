import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import AskBox from "../components/AskBox";
import ProgressTimeline from "../components/ProgressTimeline";
import Spinner from "../components/Spinner";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";

// ── Hebrew city labels ────────────────────────────────────────────────────────
const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

// ── Session cache — so leaving the tab/page and coming back shows the data
// instantly instead of re-running the loading spinner. A background fetch
// still refreshes it on every mount, just without blocking the UI.
const CACHE_PREFIX = "dashboard_cache:";

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Storage full/unavailable — caching is a nice-to-have, ignore.
  }
}

// ── Group a flat item list by category ───────────────────────────────────────
function groupByCategory(items) {
  const map = {};
  for (const item of items) {
    const key = item.category || "other";
    if (!map[key]) map[key] = { key, label: item.category_label || "אחר", items: [] };
    map[key].items.push(item);
  }
  return Object.values(map);
}

// ── Tasks section — all moving_tasks, grouped by category ────────────────────
function TasksSection({ tasks, onStatusChange, savingId }) {
  const groups = groupByCategory(tasks);

  if (!groups.length) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant text-right">
        עדיין אין משימות מעבר — נחזור בקרוב.
      </p>
    );
  }

  return (
    <div className="space-y-lg">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md text-right flex items-center gap-sm">
            <span className="w-1 h-5 bg-primary rounded-full inline-block" />
            {g.label}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
            {g.items.map((item) => {
              const id = `${item.item_type}:${item.item_id}`;
              return (
                <TaskCard
                  key={id}
                  item={item}
                  saving={savingId === id}
                  onStatusChange={onStatusChange}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Info card — collapsed accordion, title always visible ─────────────────────
function InfoCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.summary || item.discount_amount || item.source_url;

  return (
    <div className="bg-white rounded-xl border border-outline-variant/30 soft-shadow text-right">
      {/* Header — always visible */}
      <div className="p-md flex justify-between items-start gap-sm">
        <h4 className="font-headline-sm text-headline-sm text-on-surface flex-1">
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
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-xs w-full px-md pb-md font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span>{expanded ? "סגור" : "פרטים"}</span>
          <span className="material-symbols-outlined text-sm">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      )}

      {/* Accordion content */}
      {expanded && (
        <div className="border-t border-outline-variant/20 px-md pt-sm pb-md space-y-sm">
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
      )}
    </div>
  );
}

// ── Info section — rights items filtered by city + interests ──────────────────
function InfoSection({ items, interestCategories, destinationCity }) {
  const cityLabel = CITY_LABELS[destinationCity] || null;

  const filtered = items.filter((item) => {
    if (!interestCategories || interestCategories.includes("all")) return true;
    return interestCategories.includes(item.category);
  });

  if (!filtered.length) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant text-right">
        {!destinationCity
          ? "הוסיפו עיר יעד בפרופיל כדי לראות מידע רלוונטי."
          : "לא נמצא מידע מתאים להעדפות שלך."}
      </p>
    );
  }

  return (
    <div>
      {cityLabel && (
        <p className="font-label-md text-label-md text-on-surface-variant mb-md text-right">
          מוצג מידע רלוונטי ל{cityLabel}
          {interestCategories && !interestCategories.includes("all") && " · לפי הנושאים שבחרת"}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
        {filtered.map((item) => (
          <InfoCard key={`${item.item_type}:${item.item_id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { userProfile } = useAuth();

  const fullName         = userProfile?.full_name        ?? null;
  const moveDate        = userProfile?.move_date        ?? null;
  const destinationCity = userProfile?.destination_city ?? null;
  const interestCats    = userProfile?.interest_categories ?? null;

  const cacheKey = destinationCity || "none";
  const cached   = readCache(cacheKey);

  const [progress,   setProgress]   = useState(cached?.progress ?? null);
  const [tasks,      setTasks]      = useState(cached?.tasks ?? []);
  const [rights,     setRights]     = useState(cached?.rights ?? []);
  const [loading,    setLoading]    = useState(!cached);
  const [error,      setError]      = useState(null);
  const [savingId,   setSavingId]   = useState(null);
  const [showInfo,   setShowInfo]   = useState(false);

  useEffect(() => {
    let alive = true;
    // Only show the spinner when there's nothing cached to show meanwhile —
    // this still refetches fresh data every mount, just silently.
    if (!readCache(cacheKey)) setLoading(true);
    Promise.all([
      api.progress(),
      api.items({ type: "moving_task" }),
      api.items({ type: "rights_item", city: destinationCity }),
    ])
      .then(([p, t, r]) => {
        if (!alive) return;
        setProgress(p);
        setTasks(t);
        setRights(r);
        writeCache(cacheKey, { progress: p, tasks: t, rights: r });
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [destinationCity]);

  const handleStatusChange = async (item, status) => {
    const key = `${item.item_type}:${item.item_id}`;
    setSavingId(key);
    try {
      const updated = await api.setStatus(item.item_type, item.item_id, {
        status,
        notes: item.notes ?? null,
        next_action: item.next_action ?? null,
      });
      setTasks((prev) => {
        const next = prev.map((it) =>
          it.item_type === updated.item_type && it.item_id === updated.item_id ? updated : it
        );
        writeCache(cacheKey, { progress, tasks: next, rights });
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">

        <section className="mb-lg text-right">
          {fullName && (
            <p className="font-headline-lg text-headline-lg text-on-surface-variant text-center mb-md">
              <span>היי,</span>
              <span className="ms-sm">{fullName}!</span>
            </p>
          )}
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight">
            מלווים אותך שלב אחר שלב עד שמרגישים בבית
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            כל המשימות והמידע למעבר דירה במקום אחד
          </p>
        </section>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md mb-md">
            שגיאה בטעינת הנתונים: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <ProgressTimeline
              moveDate={moveDate}
              destinationCity={destinationCity}
              completed={progress?.completed ?? 0}
              total={progress?.total ?? 0}
              byStatus={progress?.by_status ?? {}}
            />

            <section className="mb-xl">
              <div className="mb-md">
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  משימות לקראת המעבר
                </h2>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {progress ? `${progress.completed} מתוך ${progress.total} משימות הושלמו` : ""}
                </span>
              </div>
              <TasksSection
                tasks={tasks}
                onStatusChange={handleStatusChange}
                savingId={savingId}
              />
            </section>

            <section className="mb-xl">
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="w-full text-right mb-md group"
              >
                <h2 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">
                  מידע נוסף
                </h2>
                <span className="flex items-center gap-sm text-on-surface-variant font-label-md text-label-md group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-base">
                    {showInfo ? "expand_less" : "expand_more"}
                  </span>
                  {showInfo ? "סגור" : "זכויות והטבות לפי הפרופיל שלך"}
                </span>
              </button>

              {showInfo && (
                <InfoSection
                  items={rights}
                  interestCategories={interestCats}
                  destinationCity={destinationCity}
                />
              )}
            </section>

            <AskBox
              profile={{}}
              seedQuery="מהן הזכויות וההנחות הרלוונטיות לי כמי שעובר/ת דירה?"
            />
          </>
        )}
      </main>
    </div>
  );
}
