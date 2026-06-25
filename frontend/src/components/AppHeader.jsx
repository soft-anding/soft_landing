import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function BellIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className={className}>
      <rect width="256" height="256" fill="none" />
      <path d="M96,192a32,32,0,0,0,64,0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <path d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
    </svg>
  );
}

// Fixed, blurred top nav matching the Stitch dashboard header.
export default function AppHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  return (
    <header className="fixed top-0 right-0 w-full z-50 bg-surface/80 backdrop-blur-md shadow-sm">
      <nav className="w-full px-gutter py-sm flex justify-between items-center h-16">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-base"
          aria-label="לוח הבקרה"
        >
          <span className="w-9 h-9 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              home_pin
            </span>
          </span>
          <span className="text-headline-md font-headline-md font-bold text-primary">נחיתה רכה</span>
        </button>

        <div className="flex items-center gap-sm">
          <button
            type="button"
            aria-label="התראות"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
          >
            <BellIcon className="w-6 h-6" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="תפריט פרופיל"
              className="flex items-center gap-xs"
            >
              <span className="w-9 h-9 rounded-lg bg-outline-variant/30 flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined">person</span>
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">
                expand_more
              </span>
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full mt-xs w-40 bg-white rounded-sm soft-shadow border border-outline-variant/30 overflow-hidden text-right">
                <button
                  type="button"
                  className="w-full px-md py-sm font-label-md text-label-md text-on-surface-variant hover:bg-outline-variant/10 transition-colors text-right border-b border-outline-variant/30"
                >
                  הפרופיל שלי
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full px-md py-sm font-label-md text-label-md text-error hover:bg-outline-variant/10 transition-colors text-right"
                >
                  התנתק
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
