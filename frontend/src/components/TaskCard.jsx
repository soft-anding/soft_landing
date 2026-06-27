import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUSES, STATUS_ICON, statusStyle } from "../statusConfig";
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
        <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-xl border border-outline-variant/30 shadow-lg overflow-hidden min-w-max">
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

export default function TaskCard({ item, onStatusChange, saving }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const done = item.status === "הושלם";

  return (
    <div
      className={`bg-white rounded-xl border soft-shadow flex flex-col min-h-32 transition-all duration-200 ${
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
          <h3
            className={`font-headline-sm text-headline-sm text-on-surface line-clamp-2 min-h-[3rem] ${
              done ? "line-through opacity-50" : ""
            }`}
          >
            {item.title_he || "ללא כותרת"}
          </h3>
        </div>

        {/* Status picker — click to open dropdown and change status inline */}
        <StatusPicker item={item} onStatusChange={onStatusChange} saving={saving} />
      </div>

      {/* ── Accordion toggle ──────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-xs px-md pb-md mt-auto font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
      >
        <span>{expanded ? "סגור" : "פרטים נוספים"}</span>
        <span className="material-symbols-outlined text-sm">
          {expanded ? "close" : "chevron_left"}
        </span>
      </button>

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

          {/* Custom task: deadline badge */}
          {item.is_custom && item.deadline_type && (
            <div className="flex items-center gap-xs text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-base">schedule</span>
              {item.deadline_type === "before_move" && "לפני המעבר"}
              {item.deadline_type === "move_day"    && "יום המעבר"}
              {item.deadline_type === "after_move"  && "אחרי המעבר"}
              {item.deadline_type === "specific_date" && item.deadline_date && item.deadline_date}
            </div>
          )}

          {/* Footer: detail page link — hidden for custom tasks (no detail page) */}
          {!item.is_custom && (
            <div className="flex items-center pt-sm border-t border-outline-variant/20">
              <button
                onClick={() => navigate(`/item/${item.item_type}/${item.item_id}`)}
                className="font-label-sm text-label-sm text-primary inline-flex items-center gap-xs hover:underline"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                עמוד מלא
              </button>
            </div>
          )}
        </div>
      </SideDrawer>
    </div>
  );
}
