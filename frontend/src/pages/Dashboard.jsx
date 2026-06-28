import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import AddCustomTaskModal from "../components/AddCustomTaskModal";
import ProgressTimeline from "../components/ProgressTimeline";
import SideDrawer from "../components/SideDrawer";
import Spinner from "../components/Spinner";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { STATUSES } from "../statusConfig";

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

// ── Derive per-category totals + completion counts from the tasks array ───────
function getCategorySummaries(tasks) {
  const map = {};
  for (const item of tasks) {
    const key = item.category || "other";
    if (!map[key]) {
      map[key] = { category: key, label: item.category_label || "אחר", total: 0, completed: 0 };
    }
    map[key].total++;
    if (item.status === "הושלם") map[key].completed++;
  }
  return Object.values(map).map((g) => ({
    ...g,
    percentage: g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0,
  }));
}

// ── Derive the header's progress summary from the already-known tasks array —
// mirrors the backend's /progress computation exactly, so the header updates
// instantly on a status change instead of waiting on a second round trip.
function computeProgress(tasks) {
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const it of tasks) by_status[it.status] = (by_status[it.status] || 0) + 1;
  const total = tasks.length;
  const completed = by_status["הושלם"] || 0;
  return {
    total,
    tracked: total,
    completed,
    completed_pct: total ? Math.round((completed / total) * 100) : 0,
    by_status,
  };
}

// ── Inline SVG donut/ring chart ───────────────────────────────────────────────
function DonutChart({ percentage, size = 68 }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc = Math.min(Math.max(percentage, 0), 100);
  const dash = (arc / 100) * circ;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#d0ebe2" strokeWidth={stroke} />
      {arc > 0 && (
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke="#3e6658"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
        />
      )}
    </svg>
  );
}

// ── Single category summary box ───────────────────────────────────────────────
// When `onCollapse` is provided the box renders as a <div> (not a <button>) so we
// can place a real <button> inside it for the collapse action without nesting issues.
// When `compact` is true the box shrinks for the "other categories" row in State 2.
function CategorySummaryBox({ summary, onClick, onCollapse, compact = false }) {
  const pinned = !!onCollapse;
  const chartSize = compact ? 56 : pinned ? 112 : 68;
  const pct = summary.percentage;

  const inner = (
    <>
      <div className="flex items-center justify-center gap-xs w-full">
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="shrink-0 flex items-center text-primary hover:bg-primary-container/20 rounded-full p-xs transition-colors"
            title="חזור לכל הקטגוריות"
          >
            <span className="material-symbols-outlined" style={{ fontSize: pinned ? "1.5rem" : "1.1rem", lineHeight: 1 }}>
              expand_less
            </span>
          </button>
        )}
        <span
          className={`text-on-surface leading-snug ${
            compact ? "font-label-sm text-label-sm" : pinned ? "font-headline-sm text-headline-sm" : "font-label-md text-label-md"
          }`}
        >
          {summary.label}
        </span>
      </div>
      <div className="relative my-xs">
        <DonutChart percentage={pct} size={chartSize} />
        <span
          className="absolute inset-0 flex items-center justify-center font-semibold text-primary"
          style={{ fontSize: compact ? "0.85rem" : pinned ? "1.5rem" : "0.72rem" }}
        >
          {pct}%
        </span>
      </div>
      {!compact && pinned && (
        <div className="inline-flex flex-col items-center w-fit">
          <span className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">
            {`השלמתם ${summary.completed} מתוך ${summary.total} משימות`}
          </span>
          <div className="h-1.5 mt-xs rounded-full bg-outline-variant/20 overflow-hidden w-[calc(100%+1rem)] -mx-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {!compact && !pinned && (
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          {`${summary.completed} מתוך ${summary.total}`}
        </span>
      )}
    </>
  );

  if (onCollapse) {
    return (
      <div className="bg-white rounded-2xl border-2 border-primary/40 soft-shadow flex flex-col items-center gap-md p-lg w-full text-center">
        {inner}
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-outline-variant/30 soft-shadow flex flex-col items-center gap-sm p-md transition-all duration-150 hover:border-primary/50 hover:bg-surface-bright active:scale-[0.97] w-full text-center cursor-pointer"
    >
      {inner}
    </button>
  );
}

// Tailwind needs to see the full class names at build time, so keep the map static.
const GRID_COLS_CLASS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
function gridColsClass(n) {
  if (n <= 3) return GRID_COLS_CLASS[n] ?? GRID_COLS_CLASS[3]; // 1, 2, or 3 → exact fit in one row
  if (n === 4) return GRID_COLS_CLASS[2];                      // 2×2
  if (n <= 9) return GRID_COLS_CLASS[3];                       // up to 3 rows of 3
  return GRID_COLS_CLASS[4];
}

// ── Urgency sort helpers ──────────────────────────────────────────────────────
const URGENCY_RANK = { before_move: 1, move_day: 2, after_move: 3 };

function sortByUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    const aHasDate = a.deadline_type === "specific_date" && a.deadline_date;
    const bHasDate = b.deadline_type === "specific_date" && b.deadline_date;

    if (aHasDate && bHasDate) return a.deadline_date.localeCompare(b.deadline_date);
    if (aHasDate) return -1;
    if (bHasDate) return 1;

    const aStage = a.deadline_type || a.timeline_stage;
    const bStage = b.deadline_type || b.timeline_stage;
    return (URGENCY_RANK[aStage] ?? 4) - (URGENCY_RANK[bStage] ?? 4);
  });
}

// ── Tasks section — State 1 (overview grid) + State 2 (expanded category) ────
function TasksSection({ tasks, onStatusChange, onDeadlineChange, savingId, onAddTask }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [urgencySort, setUrgencySort] = useState(false);

  // Re-derive summaries live from tasks so counts update when a task status changes.
  const summaries = getCategorySummaries(tasks);

  // Always look up the pinned summary from the current summaries array so the
  // donut chart and counts refresh after a status change without re-clicking.
  const pinnedSummary = expandedCategory
    ? (summaries.find((s) => s.category === expandedCategory.category) ?? expandedCategory)
    : null;

  // ── Controls row — always visible ────────────────────────────────────────
  const controls = (
    <div className="flex items-center justify-between gap-md flex-wrap">
      <button
        onClick={onAddTask}
        className="flex items-center gap-xs px-md py-sm rounded-lg border border-green-600/30 text-green-700 font-label-sm text-label-sm hover:border-green-600/60 hover:bg-green-50 transition-colors shrink-0"
      >
        <span className="material-symbols-outlined text-sm">add_circle</span>
        הוסף משימה אישית
      </button>
      <button
        onClick={() => { setUrgencySort((v) => !v); setExpandedCategory(null); }}
        className={`flex items-center gap-xs px-md py-sm rounded-lg border font-label-sm text-label-sm transition-all shrink-0
          ${urgencySort
            ? "bg-green-50 text-green-700 border-green-600/60 font-semibold"
            : "text-on-surface-variant border-green-600/30 hover:text-green-700 hover:border-green-600/60"}`}
      >
        <span className="material-symbols-outlined text-sm">{urgencySort ? "grid_view" : "sort"}</span>
        {urgencySort ? "חזרה לתצוגת קטגוריות" : "מיין לפי דחיפות"}
      </button>
    </div>
  );

  if (!summaries.length) {
    return (
      <div className="space-y-lg">
        {controls}
        <p className="font-body-md text-body-md text-on-surface-variant text-right">
          עדיין אין משימות מעבר — נחזור בקרוב.
        </p>
      </div>
    );
  }

  // ── Urgency sort view — flat sorted list ─────────────────────────────────
  if (urgencySort) {
    const sorted = sortByUrgency(tasks);
    return (
      <div className="space-y-lg">
        {controls}
        <div className="flex flex-col gap-md">
          {sorted.map((item) => {
            const id = `${item.item_type}:${item.item_id}`;
            return (
              <TaskCard
                key={id}
                item={item}
                saving={savingId === id}
                onStatusChange={onStatusChange}
                onDeadlineChange={onDeadlineChange}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ── State 2: expanded single-category view ───────────────────────────────
  if (expandedCategory) {
    const catKey = expandedCategory.category;
    const catTasks = tasks.filter((t) => (t.category || "other") === catKey);
    const otherSummaries = summaries.filter((s) => s.category !== catKey);

    return (
      <div className="space-y-lg">
        {controls}

        {/* Pinned category box — same visual as overview boxes, with collapse chevron */}
        <CategorySummaryBox
          summary={pinnedSummary}
          onCollapse={() => setExpandedCategory(null)}
        />

        {/* Task list for the selected category — reuses existing TaskCard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start">
          {catTasks.map((item) => {
            const id = `${item.item_type}:${item.item_id}`;
            return (
              <TaskCard
                key={id}
                item={item}
                saving={savingId === id}
                onStatusChange={onStatusChange}
                onDeadlineChange={onDeadlineChange}
              />
            );
          })}
        </div>

        {/* Remaining categories — compact clickable row to switch category */}
        {otherSummaries.length > 0 && (
          <div>
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-sm text-right">
              קטגוריות נוספות
            </p>
            <div className={`grid ${gridColsClass(otherSummaries.length)} gap-sm`}>
              {otherSummaries.map((s) => (
                <CategorySummaryBox
                  key={s.category}
                  summary={s}
                  compact
                  onClick={() => setExpandedCategory(s)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── State 1: overview grid ────────────────────────────────────────────────
  return (
    <div className="space-y-lg">
      {controls}
      <div className={`grid ${gridColsClass(summaries.length)} gap-md`}>
        {summaries.map((s) => (
          <CategorySummaryBox
            key={s.category}
            summary={s}
            onClick={() => setExpandedCategory(s)}
          />
        ))}
      </div>
    </div>
  );
}

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

  const [progress,     setProgress]     = useState(cached?.progress ?? null);
  const [tasks,        setTasks]        = useState(cached?.tasks ?? []);
  const [rights,       setRights]       = useState(cached?.rights ?? []);
  const [loading,      setLoading]      = useState(!cached);
  const [error,        setError]        = useState(null);
  const [savingId,     setSavingId]     = useState(null);
  const [showInfo,     setShowInfo]     = useState(false);
  const [showAddTask,  setShowAddTask]  = useState(false);

  useEffect(() => {
    let alive = true;
    function load(showSpinner) {
      if (showSpinner) setLoading(true);
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
        .finally(() => alive && showSpinner && setLoading(false));
    }
    // Only show the spinner when there's nothing cached to show meanwhile —
    // this still refetches fresh data every mount, just silently.
    load(!readCache(cacheKey));

    // The task-AI chat changes tasks server-side with no direct callback into
    // this component, so it broadcasts this event instead — refetch silently
    // (no spinner) so the header/list pick up the change right away instead
    // of waiting for the next mount.
    function onTasksChanged() { load(false); }
    window.addEventListener("tasks-changed", onTasksChanged);

    return () => {
      alive = false;
      window.removeEventListener("tasks-changed", onTasksChanged);
    };
  }, [destinationCity]);

  const handleTaskCreated = (newItem) => {
    setTasks((prev) => {
      const next = [...prev, newItem];
      const nextProgress = computeProgress(next);
      setProgress(nextProgress);
      writeCache(cacheKey, { progress: nextProgress, tasks: next, rights });
      return next;
    });
  };

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
        const nextProgress = computeProgress(next);
        setProgress(nextProgress);
        writeCache(cacheKey, { progress: nextProgress, tasks: next, rights });
        return next;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeadlineChange = async (item, deadlineData) => {
    const key = `${item.item_type}:${item.item_id}`;
    setSavingId(key);
    try {
      const updated = await api.setDeadline(item.item_type, item.item_id, deadlineData);
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
      {showAddTask && (
        <AddCustomTaskModal
          onClose={() => setShowAddTask(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
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
                onDeadlineChange={handleDeadlineChange}
                savingId={savingId}
                onAddTask={() => setShowAddTask(true)}
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

          </>
        )}
      </main>
    </div>
  );
}
