// The Stitch "WOW" element: an animated truck driving along a progress track.
// `pct` (0-100) drives both the fill width and the truck position.
export default function ProgressTimeline({ pct = 0, byStatus = {} }) {
  const clamped = Math.max(0, Math.min(100, pct));

  const stages = [
    ["לפני חתימה", "draft"],
    ["אחרי חוזה", "history_edu"],
    ["שבוע לפני", "inventory_2"],
    ["יום המעבר", "local_shipping"],
    ["אחרי המעבר", "celebration"],
  ];
  // Light up stages proportionally to progress.
  const activeStages = Math.round((clamped / 100) * stages.length);

  return (
    <section className="mb-xl">
      <div className="bg-white rounded-2xl p-lg shadow-sm relative overflow-hidden">
        <div className="flex flex-wrap gap-sm justify-between items-center mb-lg">
          <div className="bg-primary-container/20 text-primary font-bold px-4 py-2 rounded-full">
            {clamped}% מהמסלול הושלם
          </div>
          <span className="text-on-surface-variant font-label-md">התקדמות המעבר שלך</span>
        </div>

        <div className="relative py-xl">
          {/* Track (RTL: fill from the right) */}
          <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-outline-variant -translate-y-1/2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container transition-all duration-1000 ease-out ml-auto"
              style={{ width: `${clamped}%` }}
            />
          </div>

          {/* Truck */}
          <div
            className="absolute top-1/2 -translate-y-full mb-2 truck-animation transition-all duration-1000 ease-out"
            style={{ right: `calc(${clamped}% - 20px)` }}
          >
            <div className="bg-white p-2 rounded-lg shadow-md border border-primary-container/30">
              <span
                className="material-symbols-outlined text-primary text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                local_shipping
              </span>
            </div>
          </div>

          {/* Stage nodes */}
          <div className="relative z-10 flex justify-between">
            {stages.map(([label], i) => {
              const done = i < activeStages;
              return (
                <div key={label} className="flex flex-col items-center text-center">
                  <div
                    className={`w-6 h-6 rounded-full border-4 border-white shadow-sm ring-2 ${
                      done ? "bg-primary ring-primary" : "bg-outline-variant ring-outline-variant"
                    }`}
                  />
                  <span
                    className={`mt-4 font-label-md ${
                      done ? "text-primary font-bold" : "text-on-surface-variant"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status summary chips */}
        <div className="flex flex-wrap gap-sm pt-md border-t border-surface-variant/30">
          {Object.entries(byStatus)
            .filter(([, n]) => n > 0)
            .map(([status, n]) => (
              <span
                key={status}
                className="text-label-sm px-3 py-1 rounded-full bg-surface-container text-on-surface-variant"
              >
                {status}: {n}
              </span>
            ))}
        </div>
      </div>
    </section>
  );
}
