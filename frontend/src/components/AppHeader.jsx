import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Fixed, blurred top nav matching the Stitch dashboard header.
export default function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email;

  return (
    <header className="fixed top-0 right-0 w-full z-50 bg-surface/80 backdrop-blur-md shadow-sm">
      <nav className="max-w-container-max mx-auto px-gutter py-sm flex flex-row-reverse justify-between items-center h-16">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-base"
          aria-label="דף הבית"
        >
          <span className="w-9 h-9 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              home_pin
            </span>
          </span>
          <span className="text-headline-md font-headline-md font-bold text-primary">נחיתה רכה</span>
        </button>
        <div className="flex items-center gap-sm">
          {name && (
            <span className="hidden sm:inline text-label-md text-on-surface-variant">שלום, {name}</span>
          )}
          <button
            onClick={signOut}
            className="bg-primary hover:bg-primary/90 text-on-primary px-gutter py-2 rounded-full font-label-md transition-all duration-200 flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span className="hidden sm:inline">התנתקות</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
