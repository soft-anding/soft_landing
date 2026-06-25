/**
 * Time-based moving timeline.
 *
 * The truck position reflects how close the move date is, NOT task completion.
 * Truck at far right (RTL start) = move is far away.
 * Truck at far left (RTL end)    = move is today or past.
 *
 * Props:
 *   moveDate    – ISO date string from user_profiles (e.g. "2025-09-01"), or null
 *   completed   – number of completed tasks (for the bottom chips)
 *   total       – total tasks
 *   byStatus    – { status: count } map for the chips
 */

const WINDOW_DAYS = 90; // truck starts moving 90 days before the move date

// Milestone nodes spaced evenly along the track.
// Each node lights up when the truck has reached or passed its position.
const STAGES = [
  { pct: 0,   label: "3 חודשים" },
  { pct: 25,  label: "חודשיים"  },
  { pct: 50,  label: "חודש"     },
  { pct: 75,  label: "שבוע"     },
  { pct: 100, label: "הגיע!"    },
];

const CITY_LABELS = {
  jerusalem: "ירושלים",
  tel_aviv:  "תל אביב",
};

function computeProgress(moveDate) {
  if (!moveDate) return { pct: 0, daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const move = new Date(moveDate);
  move.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((move - today) / (86_400_000));
  // Linear mapping: WINDOW_DAYS before → 0%, move day → 100%
  const pct = Math.max(0, Math.min(100, ((WINDOW_DAYS - daysLeft) / WINDOW_DAYS) * 100));
  return { pct, daysLeft };
}

function CountdownBadge({ daysLeft, destinationCity }) {
  const cityLabel = CITY_LABELS[destinationCity] || null;

  if (daysLeft === null) {
    return (
      <div className="text-on-surface-variant font-label-md text-label-md">
        הגדירו תאריך מעבר כדי לראות את הספירה לאחור
      </div>
    );
  }

  if (daysLeft < 0) {
    return (
      <div className="flex flex-col">
        <span className="font-headline-md text-headline-md text-primary">
          מזל טוב! אתם כבר בבית החדש 🎉
        </span>
        {cityLabel && (
          <span className="font-label-md text-label-md text-on-surface-variant mt-xs">
            ב{cityLabel}
          </span>
        )}
      </div>
    );
  }

  if (daysLeft === 0) {
    return (
      <div className="flex flex-col">
        <span className="font-headline-md text-headline-md text-primary">
          יום המעבר הגיע! 🚚
        </span>
        {cityLabel && (
          <span className="font-label-md text-label-md text-on-surface-variant mt-xs">
            עוברים ל{cityLabel} היום
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-xs">
        <span className="text-4xl font-bold text-primary leading-none">{daysLeft}</span>
        <span className="font-headline-sm text-headline-sm text-on-surface">
          ימים
        </span>
      </div>
      <span className="font-label-md text-label-md text-on-surface-variant mt-xs">
        עד המעבר{cityLabel ? ` ל${cityLabel}` : ""}
      </span>
    </div>
  );
}

export default function ProgressTimeline({
  moveDate   = null,
  destinationCity = null,
  completed  = 0,
  total      = 0,
  byStatus   = {},
}) {
  const { pct, daysLeft } = computeProgress(moveDate);
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <section className="mb-xl">
      <div className="bg-white rounded-2xl p-lg shadow-sm relative overflow-hidden">

        {/* Header row: countdown + label */}
        <div className="flex flex-wrap gap-sm justify-between items-start mb-lg">
          <CountdownBadge daysLeft={daysLeft} destinationCity={destinationCity} />
          <div className="flex flex-col items-end gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">
              התקדמות המעבר שלך
            </span>
            {total > 0 && (
              <span className="bg-primary-container/20 text-primary font-label-md text-label-md px-3 py-1 rounded-full">
                {completed} מתוך {total} משימות הושלמו
              </span>
            )}
          </div>
        </div>

        {/* Track + truck */}
        <div className="relative py-xl">
          {/* Track background (RTL: fill expands from the right) */}
          <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-outline-variant -translate-y-1/2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out ml-auto"
              style={{ width: `${clamped}%` }}
            />
          </div>

          {/* Truck icon — positioned using `right` so 0% = far right, 100% = far left */}
          <div
            className="absolute top-1/2 -translate-y-full transition-all duration-1000 ease-out"
            style={{ right: `calc(${clamped}% - 1.5rem)` }}
          >
            <div className="relative group">
              {/* Days-left bubble above the truck */}
              {daysLeft !== null && daysLeft >= 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-on-primary text-xs font-bold px-2 py-0.5 rounded-full shadow">
                  {daysLeft === 0 ? "היום!" : `${daysLeft}י`}
                </div>
              )}
              <div className="bg-white p-2 rounded-lg shadow-md border border-primary/20">
                <span
                  className="material-symbols-outlined text-primary text-4xl truck-animation"
                  style={{
                    fontVariationSettings: "'FILL' 1",
                    transform: "scaleX(-1)",
                    display: "inline-block",
                  }}
                >
                  local_shipping
                </span>
              </div>
            </div>
          </div>

          {/* Milestone nodes */}
          <div className="relative z-10 flex justify-between">
            {STAGES.map((s) => {
              const done = clamped >= s.pct;
              return (
                <div key={s.label} className="flex flex-col items-center text-center">
                  <div
                    className={`w-5 h-5 rounded-full border-4 border-white shadow-sm ring-2 transition-colors duration-500 ${
                      done
                        ? "bg-primary ring-primary"
                        : "bg-outline-variant ring-outline-variant"
                    }`}
                  />
                  <span
                    className={`mt-4 font-label-sm text-label-sm transition-colors duration-500 ${
                      done ? "text-primary font-bold" : "text-on-surface-variant"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task-status chips */}
        {Object.values(byStatus).some((n) => n > 0) && (
          <div className="flex flex-wrap gap-sm pt-md border-t border-surface-variant/30">
            {Object.entries(byStatus)
              .filter(([, n]) => n > 0)
              .map(([status, n]) => (
                <span
                  key={status}
                  className="font-label-sm text-label-sm px-3 py-1 rounded-full bg-surface-container text-on-surface-variant"
                >
                  {status}: {n}
                </span>
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
