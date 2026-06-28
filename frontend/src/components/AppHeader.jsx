import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { prefetchForms } from "../formsCache";
import { prefetchRights } from "../rightsCache";
import NotificationsBell from "./NotificationsBell";
import ProfileDrawer from "./ProfileDrawer";

const TABS = [
  { path: "/dashboard",  label: "הדשבורד שלי" },
  { path: "/rights",     label: "זכויות והטבות" },
  { path: "/documents",  label: "מסמכים וטפסים" },
];

// Fixed, blurred top nav matching the Stitch dashboard header.
export default function AppHeader() {
  const { signOut, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  // AppHeader is on every authenticated page, so this is the earliest place
  // to start loading the rights/benefits page's data — by the time the user
  // clicks the tab, it's already cached and the page renders instantly.
  useEffect(() => {
    prefetchRights(userProfile?.destination_city ?? null);
    prefetchForms(userProfile?.destination_city ?? null);
  }, [userProfile?.destination_city]);

  return (
    <>
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

        <div className="flex items-center gap-lg">
          {TABS.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`px-sm py-xs rounded font-label-md text-label-md transition-colors ${
                  active
                    ? "text-primary font-bold"
                    : "text-on-surface-variant hover:text-primary hover:bg-outline-variant/10"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-sm">
          <NotificationsBell />

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
              <div className="absolute left-0 top-full mt-xs w-40 bg-white rounded-2xl soft-shadow border border-outline-variant/30 overflow-hidden text-right">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
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

    <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
