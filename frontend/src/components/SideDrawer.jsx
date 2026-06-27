import { useEffect } from "react";

// Slide-over panel from the screen edge, used instead of an inline
// accordion so long detail content doesn't push the page layout down.
export default function SideDrawer({ open, onClose, title, side = "right", children }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const sideCls    = side === "right" ? "right-0" : "left-0";
  const closedCls  = side === "right" ? "translate-x-full" : "-translate-x-full";

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        dir="rtl"
        className={`absolute inset-y-0 ${sideCls} w-full sm:w-1/3 sm:min-w-[360px] bg-white soft-shadow flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : closedCls
        }`}
      >
        <div className="relative px-md py-sm border-b border-outline-variant/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="absolute top-sm right-sm w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <h3 className="font-headline-sm text-headline-sm text-on-surface text-center px-lg">{title}</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-md py-md text-right">
          {children}
        </div>
      </div>
    </div>
  );
}
