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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
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
          className="flex items-center justify-between w-full px-md pb-md font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-sm">
            {expanded ? "expand_less" : "expand_more"}
          </span>
          <span>{expanded ? "סגור" : "פרטים"}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
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

  const [progress,   setProgress]   = useState(null);
  const [tasks,      setTasks]      = useState([]);
  const [rights,     setRights]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [savingId,   setSavingId]   = useState(null);

  const moveDate        = userProfile?.move_date        ?? null;
  const destinationCity = userProfile?.destination_city ?? null;
  const interestCats    = userProfile?.interest_categories ?? null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
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
      setTasks((prev) =>
        prev.map((it) =>
          it.item_type === updated.item_type && it.item_id === updated.item_id ? updated : it
        )
      );
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
          <h1 className="font-headline-xl text-headline-xl text-primary mb-sm leading-tight">
            המסלול שלך למעבר רגוע
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            המשאית כבר על הדרך — הנה מה שצריך לעשות ומתי.
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
              <div className="flex justify-between items-center mb-md">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {progress ? `${progress.completed} מתוך ${progress.total} הושלמו` : ""}
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  משימות המעבר
                </h2>
              </div>
              <TasksSection
                tasks={tasks}
                onStatusChange={handleStatusChange}
                savingId={savingId}
              />
            </section>

            <section className="mb-xl">
              <div className="flex justify-between items-center mb-md">
                <span className="font-label-md text-label-md text-on-surface-variant">
                  זכויות והטבות לפי הפרופיל שלך
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  מידע נוסף
                </h2>
              </div>
              <InfoSection
                items={rights}
                interestCategories={interestCats}
                destinationCity={destinationCity}
              />
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
