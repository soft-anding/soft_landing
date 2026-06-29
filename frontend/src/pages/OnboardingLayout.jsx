import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import Spinner from "../components/Spinner";

const EXCLUDED_TOPIC_CATEGORIES = new Set([
  "אריזה והובלה",
  "הכנת הבית החדש",
  "פינוי הבית הישן",
  "פינוי דירה ישנה",
  "בירוקרטיה של עיריות",
  "בירוקרטיה ממשלתית",
  "parking_permit",
]);

export const EMPTY_FORM = {
  full_name:            "",
  origin_city:          "",
  destination_city:     "",
  move_date:            "2026-01-01",
  moving_companions:    "",
  birth_year:           "",
  marital_status:       "",
  occupation:           "",
  income_range:         "",
  has_car:              "",
  needs_movers:         "",
  special_eligibility:  [],
  interest_categories:  ["all"],
};

const STEPS = [
  { path: "step-1", label: "פרטי המעבר" },
  { path: "step-2", label: "עליכם"       },
  { path: "step-3", label: "התאמה אישית" },
];

function currentStep(pathname) {
  if (pathname.includes("step-3")) return 3;
  if (pathname.includes("step-2")) return 2;
  return 1;
}

export default function OnboardingLayout() {
  const { session, userProfile, loading } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [catsLoading, setCatsLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Fetched here (step 1) instead of in OnboardingStep3 so the list is
  // already loaded by the time the user reaches step 3, instead of making
  // them wait on navigation there.
  useEffect(() => {
    api.categories()
      .then((cats) => setCategories((cats || []).filter((c) => !EXCLUDED_TOPIC_CATEGORIES.has(c.slug))))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false));
  }, []);

  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/" replace />;
  if (userProfile) return <Navigate to="/dashboard" replace />;

  const step = currentStep(location.pathname);

  return (
    /* ── Page shell ────────────────────────────────────────────────── */
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-gutter py-xl"
      style={{ background: "#fff8ef" }}
    >
      {/* App wordmark */}
      <div className="flex items-center gap-sm mb-lg">
        <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            home_pin
          </span>
        </div>
        <span className="font-headline-lg text-headline-lg text-primary">נחיתה רכה</span>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[680px] bg-white rounded-xl soft-shadow border border-surface-variant/30 overflow-hidden">

        {/* Card header — step indicator */}
        <div className="px-md pt-md pb-sm md:px-lg border-b border-surface-variant/20">
          <div className="flex items-start">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const isDone    = n < step;
              const isCurrent = n === step;
              return (
                <div key={s.path} className={`flex items-start ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
                  <div className="flex flex-col items-center gap-xs">
                    <div
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-label-sm text-label-sm font-bold transition-colors duration-300 ${
                        isDone || isCurrent
                          ? "bg-primary text-on-primary"
                          : "bg-white text-on-surface-variant border border-outline-variant"
                      }`}
                    >
                      {n}
                    </div>
                    <span
                      className={`font-label-sm text-label-sm whitespace-nowrap ${
                        isCurrent ? "text-primary font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-xs transition-colors duration-300 ${
                        isDone ? "bg-primary" : "bg-outline-variant/40"
                      }`}
                      style={{ marginTop: "0.875rem" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card body — step content */}
        <div className="px-md pt-md pb-lg md:px-lg">
          <Outlet context={{ form, setForm, categories, catsLoading }} />
        </div>
      </div>
    </div>
  );
}
