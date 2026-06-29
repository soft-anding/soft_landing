import { useState } from "react";

export default function DailyTasksBoard({ tasks, pinnedIds, onRemove, onStatusChange }) {
  const pinned = tasks.filter((t) => pinnedIds.has(`${t.item_type}:${t.item_id}`));
  const [openKey, setOpenKey] = useState(null);

  function toggleSteps(key) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/30 soft-shadow p-md h-full flex flex-col">
      <div className="flex items-center gap-sm mb-md">
        <span className="material-symbols-outlined text-primary">event_note</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface flex-1 text-right">
          לוח יומי
        </h2>
        {pinned.length > 0 && (
          <span className="bg-primary-container text-on-primary-container rounded-full px-sm py-xs font-label-sm text-label-sm shrink-0">
            {pinned.length}
          </span>
        )}
      </div>

      {pinned.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span
            className="material-symbols-outlined block text-on-surface-variant/20 mb-sm"
            style={{ fontSize: "2.5rem" }}
          >
            add_circle
          </span>
          <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
            לחצו על + ליד משימה
            <br />
            כדי להוסיפה ללוח
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm overflow-y-auto flex-1 -mx-xs px-xs">
          {pinned.map((item) => {
            const key = `${item.item_type}:${item.item_id}`;
            const done = item.status === "הושלם";
            const steps = item.action_steps?.filter(Boolean) ?? [];
            const isOpen = openKey === key;

            return (
              <div
                key={key}
                className={`rounded-xl border transition-colors ${
                  done
                    ? "border-primary/30 bg-primary-container/10"
                    : "border-outline-variant/20"
                }`}
              >
                {/* Header row: check · title · expand · remove */}
                <div className="flex items-start gap-xs p-sm">
                  {/* Done toggle */}
                  <button
                    onClick={() => onStatusChange(item, done ? "לא התחיל" : "הושלם")}
                    className="shrink-0 mt-0.5 transition-colors"
                    title={done ? "בטל סימון" : "סמן כהושלם"}
                  >
                    <span
                      className={`material-symbols-outlined transition-colors ${
                        done ? "text-primary" : "text-on-surface-variant/30 hover:text-primary/60"
                      }`}
                      style={{
                        fontSize: "1.25rem",
                        lineHeight: 1,
                        fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      check_circle
                    </span>
                  </button>

                  {/* Title */}
                  <p
                    className={`flex-1 text-right font-label-md text-label-md leading-snug ${
                      done ? "line-through opacity-50 text-on-surface-variant" : "text-on-surface"
                    }`}
                  >
                    {item.title_he}
                  </p>

                  {/* Expand steps — only if steps exist */}
                  {steps.length > 0 && (
                    <button
                      onClick={() => toggleSteps(key)}
                      className={`shrink-0 mt-0.5 transition-colors rounded-full ${
                        isOpen
                          ? "text-primary"
                          : "text-on-surface-variant/30 hover:text-on-surface-variant"
                      }`}
                      title={isOpen ? "סגור שלבים" : "הצג שלבי ביצוע"}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "1.1rem", lineHeight: 1 }}
                      >
                        {isOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>
                  )}

                  {/* Remove from board */}
                  <button
                    onClick={() => onRemove(key)}
                    className="shrink-0 mt-0.5 text-on-surface-variant/30 hover:text-error transition-colors rounded-full"
                    title="הסר מהלוח"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                {/* Action steps — accordion */}
                {isOpen && steps.length > 0 && (
                  <div className="px-sm pb-sm border-t border-outline-variant/10 pt-xs">
                    <ol className="flex flex-col gap-xs">
                      {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-xs text-right">
                          <span className="font-label-sm text-label-sm text-primary shrink-0 mt-0.5 w-4 text-center">
                            {i + 1}.
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant leading-snug">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
