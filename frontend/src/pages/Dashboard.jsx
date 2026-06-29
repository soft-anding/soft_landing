import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "../components/AppHeader";
import AddCustomTaskModal from "../components/AddCustomTaskModal";
import DailyTasksBoard from "../components/DailyTasksBoard";
import ProgressTimeline from "../components/ProgressTimeline";
import Spinner from "../components/Spinner";
import TaskCard from "../components/TaskCard";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { STATUSES } from "../statusConfig";

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
  const chartSize = compact ? 56 : pinned ? 112 : 52;
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
      <div className="bg-white rounded-xl border-2 border-primary/40 soft-shadow flex items-center gap-md px-md py-sm w-full">
        <button
          onClick={onCollapse}
          className="shrink-0 flex items-center text-primary hover:bg-primary-container/20 rounded-full p-xs transition-colors"
          title="חזור לכל הקטגוריות"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.1rem", lineHeight: 1 }}>
            close
          </span>
        </button>
        <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
          <DonutChart percentage={pct} size={52} />
          <span
            className="absolute inset-0 flex items-center justify-center font-semibold text-primary"
            style={{ fontSize: "0.72rem" }}
          >
            {pct}%
          </span>
        </div>
        <div className="flex flex-col text-right min-w-0">
          <span className="font-headline-sm text-headline-sm text-on-surface leading-tight">
            {summary.label}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
            {summary.completed} מתוך {summary.total} משימות
          </span>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl border border-outline-variant/30 soft-shadow flex flex-col items-center gap-xs p-sm transition-all duration-150 hover:border-primary/50 hover:bg-surface-bright active:scale-[0.97] w-full text-center cursor-pointer"
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
function TasksSection({ tasks, onStatusChange, onDeadlineChange, savingId, onAddTask, pinnedIds, onPin, onUnpin }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [urgencySort, setUrgencySort] = useState(false);
  const wrapperRef = useRef(null);

  function fadeTransition(callback) {
    const el = wrapperRef.current;
    if (!el) { callback(); return; }
    el.style.opacity = "0";
    setTimeout(() => {
      callback();
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; }));
    }, 280);
  }

  const summaries = getCategorySummaries(tasks);
  const pinnedSummary = expandedCategory
    ? (summaries.find((s) => s.category === expandedCategory.category) ?? expandedCategory)
    : null;

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
        onClick={() => fadeTransition(() => { setUrgencySort((v) => !v); setExpandedCategory(null); })}
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

  // stateKey drives AnimatePresence — changes whenever the visible content changes
  const stateKey = urgencySort ? "urgency" : expandedCategory ? `cat-${expandedCategory.category}` : "overview";

  function renderContent() {
    if (!summaries.length) {
      return (
        <p className="font-body-md text-body-md text-on-surface-variant text-right">
          עדיין אין משימות מעבר — נחזור בקרוב.
        </p>
      );
    }

    if (urgencySort) {
      const sorted = sortByUrgency(tasks);
      return (
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
                isPinned={pinnedIds?.has(id)}
                onPin={onPin}
                onUnpin={onUnpin}
              />
            );
          })}
        </div>
      );
    }

    if (expandedCategory) {
      const catKey = expandedCategory.category;
      const catTasks = tasks.filter((t) => (t.category || "other") === catKey);
      const otherSummaries = summaries.filter((s) => s.category !== catKey);
      return (
        <>
          <CategorySummaryBox
            summary={pinnedSummary}
            onCollapse={() => fadeTransition(() => setExpandedCategory(null))}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md items-start mt-lg">
            {catTasks.map((item) => {
              const id = `${item.item_type}:${item.item_id}`;
              return (
                <TaskCard
                  key={id}
                  item={item}
                  saving={savingId === id}
                  onStatusChange={onStatusChange}
                  onDeadlineChange={onDeadlineChange}
                  isPinned={pinnedIds?.has(id)}
                  onPin={onPin}
                  onUnpin={onUnpin}
                />
              );
            })}
          </div>
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
                    onClick={() => fadeTransition(() => setExpandedCategory(s))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      );
    }

    return (
      <div className={`grid ${gridColsClass(summaries.length)} gap-md`}>
        {summaries.map((s) => (
          <CategorySummaryBox
            key={s.category}
            summary={s}
            onClick={() => fadeTransition(() => setExpandedCategory(s))}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {controls}
      <div ref={wrapperRef} style={{ transition: "opacity 0.28s ease" }}>
        {renderContent()}
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

  const cacheKey = destinationCity || "none";
  const cached   = readCache(cacheKey);

  const [progress,     setProgress]     = useState(cached?.progress ?? null);
  const [tasks,        setTasks]        = useState(cached?.tasks ?? []);
  const [loading,      setLoading]      = useState(!cached);
  const [error,        setError]        = useState(null);
  const [savingId,     setSavingId]     = useState(null);
  const [showAddTask,  setShowAddTask]  = useState(false);

  // Ordered array of "item_type:item_id" strings — source of truth for the daily board.
  // Order matches the `position` column in user_daily_board (agent-suggested order preserved).
  const [pinnedKeys, setPinnedKeys] = useState([]);
  // Derived Set for O(1) lookup in TaskCard pin-button rendering.
  const pinnedIds = useMemo(() => new Set(pinnedKeys), [pinnedKeys]);

  // Fetch the daily board from the DB on mount.
  useEffect(() => {
    api.getDailyBoard()
      .then((rows) => setPinnedKeys(rows.map((r) => `${r.item_type}:${r.item_id}`)))
      .catch(() => {});
  }, []);

  async function handlePin(item) {
    const key = `${item.item_type}:${item.item_id}`;
    if (pinnedIds.has(key)) return;
    // Optimistic update.
    setPinnedKeys((prev) => [...prev, key]);
    try {
      const rows = await api.addToDailyBoard([
        { item_type: item.item_type, item_id: item.item_id },
      ]);
      setPinnedKeys(rows.map((r) => `${r.item_type}:${r.item_id}`));
    } catch {
      // Roll back optimistic update on failure.
      setPinnedKeys((prev) => prev.filter((k) => k !== key));
    }
  }

  async function handleUnpin(itemKey) {
    const [itemType, itemIdStr] = itemKey.split(":");
    // Optimistic update.
    setPinnedKeys((prev) => prev.filter((k) => k !== itemKey));
    try {
      await api.removeFromDailyBoard(itemType, parseInt(itemIdStr, 10));
    } catch {
      // Roll back on failure.
      setPinnedKeys((prev) => [...prev, itemKey]);
    }
  }

  // Keep a ref to handlePin so the event listener below never goes stale.
  const handlePinRef = useRef(handlePin);
  useEffect(() => { handlePinRef.current = handlePin; });

  // Listen for daily-board-pin events dispatched by TaskAgentChat when the
  // user confirms the agent's daily task suggestions.
  useEffect(() => {
    async function onDailyBoardPin(e) {
      const suggested = e.detail?.tasks ?? [];
      if (!suggested.length) return;
      // Optimistic update — add keys not already present, in agent order.
      const newKeys = suggested
        .map((t) => `${t.item_type}:${t.item_id}`)
        .filter((k) => !pinnedIds.has(k));
      if (newKeys.length) {
        setPinnedKeys((prev) => [...prev, ...newKeys]);
      }
      try {
        const rows = await api.addToDailyBoard(suggested);
        setPinnedKeys(rows.map((r) => `${r.item_type}:${r.item_id}`));
      } catch {
        setPinnedKeys((prev) => prev.filter((k) => !newKeys.includes(k)));
      }
    }
    window.addEventListener("daily-board-pin", onDailyBoardPin);
    return () => window.removeEventListener("daily-board-pin", onDailyBoardPin);
  }, [pinnedIds]);

  useEffect(() => {
    let alive = true;
    function load(showSpinner) {
      if (showSpinner) setLoading(true);
      Promise.all([
        api.progress(),
        api.items({ type: "moving_task" }),
      ])
        .then(([p, t]) => {
          if (!alive) return;
          setProgress(p);
          setTasks(t);
          writeCache(cacheKey, { progress: p, tasks: t });
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
      writeCache(cacheKey, { progress: nextProgress, tasks: next });
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
        writeCache(cacheKey, { progress: nextProgress, tasks: next });
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
        writeCache(cacheKey, { progress, tasks: next });
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
          <div className="flex gap-lg items-start">
            {/* Right column — main content */}
            <div className="flex-1 min-w-0">
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
                  pinnedIds={pinnedIds}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                />
              </section>
            </div>

            {/* Left column — daily board (sticky, fixed viewport height) */}
            <div className="w-72 shrink-0 sticky top-32 h-[calc(100vh-9rem)]">
              <DailyTasksBoard
                tasks={tasks}
                pinnedKeys={pinnedKeys}
                onRemove={handleUnpin}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
