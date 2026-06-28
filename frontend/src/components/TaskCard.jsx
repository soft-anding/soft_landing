import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUSES, STATUS_ICON, statusStyle } from "../statusConfig";
import ShrinkToFitTitle from "./ShrinkToFitTitle";
import SideDrawer from "./SideDrawer";

// ── Inline status picker — click the badge to open a dropdown menu ────────────
function StatusPicker({ item, onStatusChange, saving }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isFilled = item.status === "הושלם";

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => !saving && setOpen((o) => !o)}
        disabled={saving}
        className={`
          flex items-center gap-xs
          px-3 py-1.5 rounded-full border
          font-label-sm text-label-sm
          ${statusStyle(item.status)}
          ${saving ? "opacity-60 cursor-wait" : "cursor-pointer hover:opacity-90 active:scale-[0.97] transition-all"}
        `}
      >
        <span
          className="material-symbols-outlined text-base"
          style={{ fontVariationSettings: isFilled ? "'FILL' 1" : "'FILL' 0" }}
        >
          {STATUS_ICON[item.status] || "radio_button_unchecked"}
        </span>
        {saving ? "…" : item.status}
        <span className="material-symbols-outlined" style={{ fontSize: "1rem", lineHeight: 1 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white rounded-md border border-outline-variant/30 shadow-lg overflow-hidden min-w-max">
          {STATUSES.map((s) => {
            const current = s === item.status;
            return (
              <button
                key={s}
                onClick={() => { setOpen(false); if (!current) onStatusChange(item, s); }}
                className={`
                  w-full flex items-center gap-sm px-md py-xs
                  font-label-sm text-label-sm text-right transition-colors
                  ${current
                    ? "bg-primary-container/20 text-primary font-semibold"
                    : "text-on-surface hover:bg-surface-container"}
                `}
              >
                <span
                  className="material-symbols-outlined text-base shrink-0"
                  style={{ fontVariationSettings: s === "הושלם" ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {STATUS_ICON[s] || "radio_button_unchecked"}
                </span>
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Deadline labels ────────────────────────────────────────────────────────────
const DEADLINE_OPTIONS = [
  { type: "before_move", label: "לפני המעבר" },
  { type: "move_day",    label: "יום המעבר"  },
  { type: "after_move",  label: "אחרי המעבר" },
];

// "YYYY-MM-DD" (the <input type="date"> / API format) → "DD/MM/YYYY" for display.
function formatDateDisplay(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function deadlineLabel(deadlineType, deadlineDate) {
  if (!deadlineType) return null;
  if (deadlineType === "specific_date") return deadlineDate ? formatDateDisplay(deadlineDate) : "תאריך";
  return DEADLINE_OPTIONS.find((o) => o.type === deadlineType)?.label ?? null;
}

// ── Inline deadline picker ─────────────────────────────────────────────────────
function DeadlinePicker({ item, onDeadlineChange, saving }) {
  const [open, setOpen]           = useState(false);
  const [showDate, setShowDate]   = useState(false);
  const [dateInput, setDateInput] = useState("2026-01-01");
  const ref = useRef(null);

  // Close the popover when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  // Reset inner state whenever the popover closes.
  useEffect(() => {
    if (!open) {
      setShowDate(false);
      setDateInput("2026-01-01");
    }
  }, [open]);

  // User-set deadline takes priority; fall back to catalog timeline_stage.
  const userSet       = !!item.deadline_type;
  const effectiveType = item.deadline_type || item.timeline_stage || null;
  const label         = deadlineLabel(effectiveType, item.deadline_date);

  // Which option is currently "active" in the dropdown (for highlight).
  const activeType = item.deadline_type || item.timeline_stage || null;

  function handleToggle() {
    if (!saving) setOpen((o) => !o);
  }

  function handleSelectPreset(type) {
    setOpen(false);
    onDeadlineChange(item, { deadline_type: type, deadline_date: null });
  }

  function handleSelectDate() {
    setShowDate(true);
    setDateInput(item.deadline_type === "specific_date" ? (item.deadline_date || "2026-01-01") : "2026-01-01");
  }

  function handleConfirmDate() {
    if (!dateInput) return;
    setOpen(false);
    onDeadlineChange(item, { deadline_type: "specific_date", deadline_date: dateInput });
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger badge */}
      <button
        onClick={handleToggle}
        disabled={saving}
        className={`flex items-center gap-xs font-label-sm text-label-sm transition-colors
          ${userSet ? "text-primary hover:text-primary/70" : label ? "text-on-surface-variant hover:text-primary" : "text-on-surface-variant/60 hover:text-primary"}
          ${saving ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
      >
        <span className="material-symbols-outlined text-base">schedule</span>
        <span>{saving ? "…" : (label || "הוסף מועד")}</span>
        <span className="material-symbols-outlined" style={{ fontSize: "0.9rem", lineHeight: 1 }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white rounded-md border border-outline-variant/30 shadow-lg overflow-hidden min-w-[9rem]">
          {!showDate ? (
            <>
              {DEADLINE_OPTIONS.map(({ type, label: optLabel }) => {
                const isActive = activeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectPreset(type)}
                    className={`w-full px-md py-sm font-label-sm text-label-sm text-right whitespace-nowrap transition-colors
                      ${isActive
                        ? "bg-primary-container/20 text-primary font-semibold"
                        : "text-on-surface hover:bg-surface-container"}`}
                  >
                    {optLabel}
                  </button>
                );
              })}
              <button
                onClick={handleSelectDate}
                className={`w-full flex items-center gap-xs px-md py-sm font-label-sm text-label-sm text-right transition-colors border-t border-outline-variant/20
                  ${item.deadline_type === "specific_date"
                    ? "bg-primary-container/20 text-primary font-semibold"
                    : "text-on-surface hover:bg-surface-container"}`}
              >
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                {item.deadline_type === "specific_date" && item.deadline_date
                  ? formatDateDisplay(item.deadline_date)
                  : "בחר תאריך…"}
              </button>
            </>
          ) : (
            <div className="px-md py-sm flex flex-col gap-xs min-w-[13rem]">
              <p className="font-label-sm text-label-sm text-on-surface-variant">בחר תאריך:</p>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                autoFocus
                className="border border-outline-variant rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <div className="flex gap-xs justify-between pt-xs">
                <button
                  onClick={() => setShowDate(false)}
                  className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  חזור
                </button>
                <button
                  onClick={handleConfirmDate}
                  disabled={!dateInput}
                  className="font-label-sm text-label-sm text-primary disabled:opacity-40 hover:text-primary/70 transition-colors"
                >
                  אישור
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskCard({ item, onStatusChange, onDeadlineChange, saving }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const done = item.status === "הושלם";

  return (
    <div
      className={`bg-white rounded-2xl border soft-shadow flex flex-col min-h-32 transition-all duration-200 ${
        done ? "border-primary/40" : "border-outline-variant/30"
      }`}
    >
      {/* ── Header (always visible) ───────────────────────────────────── */}
      <div className="p-md flex justify-between items-start gap-md">

        {/* Title + category label */}
        <div className="flex flex-col gap-xs flex-1 text-right min-w-0">
          {item.category_label && (
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              {item.category_label}
            </span>
          )}
          <ShrinkToFitTitle
            text={item.title_he || "ללא כותרת"}
            className={`font-headline-sm text-on-surface ${done ? "line-through opacity-50" : ""}`}
          />
        </div>

        {/* Status picker — click to open dropdown and change status inline */}
        <StatusPicker item={item} onStatusChange={onStatusChange} saving={saving} />
      </div>

      {/* ── Card footer: deadline (left) + details toggle (right) ────── */}
      <div className="flex items-center justify-between px-md pb-md mt-auto gap-md">
        <DeadlinePicker
          item={item}
          onDeadlineChange={onDeadlineChange}
          saving={saving}
        />
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors shrink-0"
        >
          <span>{expanded ? "סגור" : "פרטים נוספים"}</span>
          <span className="material-symbols-outlined text-sm">
            {expanded ? "close" : "chevron_left"}
          </span>
        </button>
      </div>

      {/* ── Details drawer ────────────────────────────────────────────── */}
      <SideDrawer
        open={expanded}
        onClose={() => setExpanded(false)}
        title={item.title_he || "פרטים נוספים"}
      >
        <div className="space-y-md">

          {/* Status selector also in the drawer for completeness */}
          <div>
            <p className="font-label-md text-label-md text-on-surface mb-xs">סטטוס</p>
            <select
              value={item.status}
              disabled={saving}
              onChange={(e) => onStatusChange(item, e.target.value)}
              className="w-full px-3 py-1.5 rounded-full border border-outline-variant font-label-sm text-label-sm bg-white text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          {item.summary && (
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {item.summary}
            </p>
          )}

          {/* Action steps */}
          {item.action_steps?.length > 0 && (
            <div>
              <p className="font-label-md text-label-md text-on-surface mb-xs">שלבי ביצוע:</p>
              <ol className="list-decimal list-inside space-y-xs text-on-surface-variant">
                {item.action_steps.map((step, i) => (
                  <li key={i} className="font-body-md text-body-md">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* External links */}
          {item.links?.filter(Boolean).length > 0 && (
            <div className="flex flex-col gap-xs">
              {item.links.filter(Boolean).map((link, i) => {
                const href  = typeof link === "object" ? link.url   : link;
                const label = typeof link === "object" ? link.label : "קישור";
                return href ? (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-label-md text-label-md text-primary inline-flex items-center gap-xs hover:underline"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    {label}
                  </a>
                ) : null;
              })}
            </div>
          )}

          {/* Footer: detail page link */}
          <div className="flex items-center pt-sm border-t border-outline-variant/20">
            <button
              onClick={() => navigate(`/item/${item.item_type}/${item.item_id}`, { state: { item } })}
              className="font-label-sm text-label-sm text-primary inline-flex items-center gap-xs hover:underline"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              עמוד מלא
            </button>
          </div>
        </div>
      </SideDrawer>
    </div>
  );
}
