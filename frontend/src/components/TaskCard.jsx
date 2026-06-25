import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATUSES, STATUS_ICON, statusStyle } from "../statusConfig";

// The three "quick-cycle" statuses reachable by clicking the status pill.
// Edge statuses (בבדיקה, לא רלוונטי, etc.) are still accessible via the
// full dropdown inside the accordion.
const CYCLE = ["לא התחיל", "בטיפול", "הושלם"];

function nextInCycle(current) {
  const i = CYCLE.indexOf(current);
  // Any status not in the cycle → move to "בטיפול" (started working on it).
  return i === -1 ? "בטיפול" : CYCLE[(i + 1) % CYCLE.length];
}

export default function TaskCard({ item, onStatusChange, saving }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const done        = item.status === "הושלם";
  const hasDetails  = item.summary || item.action_steps?.length || item.links?.length;
  const isFilled    = item.status === "הושלם"; // filled icon for done state

  return (
    <div
      className={`bg-white rounded-xl border soft-shadow flex flex-col transition-all duration-200 ${
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
            className={`font-headline-sm text-headline-sm text-on-surface leading-snug ${
              done ? "line-through opacity-50" : ""
            }`}
          >
            {item.title_he || "ללא כותרת"}
          </h3>
        </div>

        {/* Collapsed: quick-cycle pill. Expanded: full 7-status dropdown. */}
        {expanded ? (
          <select
            value={item.status}
            disabled={saving}
            onChange={(e) => onStatusChange(item, e.target.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full border font-label-sm text-label-sm bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 ${statusStyle(item.status)}`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => onStatusChange(item, nextInCycle(item.status))}
            disabled={saving}
            title={`סטטוס: ${item.status} — לחץ לשינוי`}
            className={`
              shrink-0 flex items-center gap-xs
              px-3 py-1.5 rounded-full border
              font-label-sm text-label-sm
              transition-colors duration-150
              hover:opacity-75 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              ${statusStyle(item.status)}
            `}
          >
            <span
              className="material-symbols-outlined text-base"
              style={{ fontVariationSettings: isFilled ? "'FILL' 1" : "'FILL' 0" }}
            >
              {STATUS_ICON[item.status] || "radio_button_unchecked"}
            </span>
            {saving ? "…" : item.status}
          </button>
        )}
      </div>

      {/* ── Accordion toggle ──────────────────────────────────────────── */}
      {hasDetails && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-xs px-md pb-md font-label-sm text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span>{expanded ? "סגור" : "פרטים נוספים"}</span>
          <span className="material-symbols-outlined text-sm">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      )}

      {/* ── Accordion content ─────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-outline-variant/20 px-md pt-sm pb-md space-y-md text-right">

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

          {/* Footer: detail page link (status dropdown now lives in the header) */}
          <div className="flex items-center pt-sm border-t border-outline-variant/20">
            <button
              onClick={() => navigate(`/item/${item.item_type}/${item.item_id}`)}
              className="font-label-sm text-label-sm text-primary inline-flex items-center gap-xs hover:underline"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              עמוד מלא
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
