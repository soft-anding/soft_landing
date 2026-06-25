const WINDOW_DAYS = 90;

const STAGES = [
  { pct: 0,   label: "3 חודשים" },
  { pct: 25,  label: "חודשיים"  },
  { pct: 50,  label: "חודש"     },
  { pct: 75,  label: "שבוע"     },
  { pct: 100, label: "הגיע!"    },
];

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
                         `${daysLeft} ימים עד המעבר${cityLabel ? ` ל${cityLabel}` : ""}`;

  return (
    <section className="mb-lg w-full">
      <div className="bg-white rounded-xl px-md pt-sm pb-xs shadow-sm">

        {/* Compact one-line header */}
        <div className="mb-xs">
          <span className="font-label-md text-label-md text-on-surface-variant">
            {countdownText}
          </span>
        </div>

        {/* Track + truck */}
        <div className="relative" style={{ paddingTop: "2.2rem", paddingBottom: "1.6rem" }}>
          {/* Track bar */}
          <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-outline-variant -translate-y-1/2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-out ml-auto"
              style={{ width: `${clamped}%` }}
            />
          </div>

          {/* Truck icon */}
          <div
            className="absolute top-1/2 -translate-y-full transition-all duration-1000 ease-out"
            style={{ right: `calc(${clamped}% - 2rem)` }}
          >
            {daysLeft !== null && daysLeft >= 0 && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-on-primary text-xs font-bold px-1.5 py-px rounded-full shadow">
                {daysLeft === 0 ? "היום!" : `${daysLeft}י`}
              </div>
            )}
            <div className="bg-white p-1 rounded-lg shadow-md border border-primary/20">
              <img
                src="/track.png"
                alt="משאית מעבר"
                className="h-16 w-auto truck-animation"
                style={{ transform: "scaleX(-1)" }}
              />
            </div>
          </div>

          {/* Milestone nodes */}
          <div className="relative z-10 flex justify-between">
            {STAGES.map((s) => {
              const done = clamped >= s.pct;
              return (
                <div key={s.label} className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ring-1 transition-colors duration-500 ${
                      done ? "bg-primary ring-primary" : "bg-outline-variant ring-outline-variant"
                    }`}
                  />
                  <span
                    className={`mt-1.5 font-label-sm text-label-sm transition-colors duration-500 ${
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
