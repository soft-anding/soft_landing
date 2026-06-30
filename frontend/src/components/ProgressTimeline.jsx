const WINDOW_DAYS = 90;

// Node positions reflect their real day thresholds (out of WINDOW_DAYS),
// not even spacing — so the truck (driven by actual days left) lines up
// with the milestone it has actually reached.
const STAGE_DAYS = [
  { days: 90, label: "3 חודשים" },
  { days: 60, label: "חודשיים"  },
  { days: 30, label: "חודש"     },
  { days: 7,  label: "שבוע"     },
  { days: 0,  label: "היום!"    },
];

const STAGES = STAGE_DAYS.map(({ days, label }) => ({
  pct: ((WINDOW_DAYS - days) / WINDOW_DAYS) * 100,
  label,
}));

const CITY_LABELS = { jerusalem: "ירושלים", tel_aviv: "תל אביב" };

function computeProgress(moveDate) {
  if (!moveDate) return { pct: 0, daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const move = new Date(moveDate);
  move.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((move - today) / 86_400_000);
  const pct = Math.max(0, Math.min(100, ((WINDOW_DAYS - daysLeft) / WINDOW_DAYS) * 100));
  return { pct, daysLeft };
}

export default function ProgressTimeline({
  moveDate        = null,
  destinationCity = null,
  completed       = 0,
  total           = 0,
}) {
  const { pct, daysLeft } = computeProgress(moveDate);
  const clamped = Math.max(0, Math.min(100, pct));
  const cityLabel = CITY_LABELS[destinationCity] || null;

  const countdownText =
    daysLeft === null  ? "הגדירו תאריך מעבר" :
    daysLeft < 0       ? "הגעתם! 🎉" :
    daysLeft === 0     ? "יום המעבר! 🚚" :
                         `יש לך עוד ${daysLeft} ימים עד המעבר${cityLabel ? ` ל${cityLabel}` : ""}`;

  return (
    <section className="mb-8 w-full">
      <div className="bg-white rounded-xl px-lg pt-sm pb-xs shadow-sm">

        {/* Compact one-line header */}
        <div className="mb-xs">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {countdownText}
          </span>
        </div>

        {/* Track + truck — fixed pixel anchor (not 50%-of-self) so the truck
            always has guaranteed clearance above the line regardless of how
            tall the nodes/labels below it end up being. */}
        <div className="relative" style={{ height: "8.5rem" }}>
          {/* Track bar — extends a bit past the container on both ends so the
              first/last dots (centered exactly on the container edges) sit
              fully on the bar instead of spilling off its rounded tips. */}
          <div
            className="absolute h-1.5 bg-outline-variant rounded-full overflow-hidden"
            style={{ top: "5rem", left: "-0.4rem", right: "-0.4rem" }}
          >
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out ml-auto"
              style={{ width: `${clamped}%` }}
            />
          </div>

          {/* Truck icon */}
          <div
            className="absolute -translate-y-full transition-all duration-1000 ease-out"
            style={{ top: "5rem", right: `calc(${clamped}% - 2.25rem)` }}
          >
            <img
              src="/track.png"
              alt="משאית מעבר"
              className="h-[4.5rem] w-auto truck-animation drop-shadow-md"
              style={{ transform: "scaleX(-1)" }}
            />
          </div>

          {/* Milestone nodes — positioned by their real pct, not evenly spaced,
              so they line up with the truck/track which use the same pct. */}
          <div className="relative z-10">
            {STAGES.map((s) => {
              const done = clamped >= s.pct;
              return (
                <div
                  key={s.label}
                  className="absolute flex flex-col items-center"
                  style={{ top: "4.5rem", right: `${s.pct}%`, transform: "translate(50%, -6px)" }}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ring-1 transition-colors duration-500 ${
                      done ? "bg-primary ring-primary" : "bg-outline-variant ring-outline-variant"
                    }`}
                  />
                  <span
                    className={`mt-1.5 whitespace-nowrap font-label-sm text-label-sm transition-colors duration-500 ${
                      done ? "text-primary font-bold" : "text-on-surface-variant"
                    }`}
                    style={{ fontSize: "0.65rem" }}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
