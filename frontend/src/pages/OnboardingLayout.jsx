import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";

export const EMPTY_FORM = {
  full_name:            "",
  origin_city:          "",
  destination_city:     "",
  move_date:            "",
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
  { path: "step-2", label: "עלייך"       },
  { path: "step-3", label: "הגדרות"      },
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
      <div className="flex items-center gap-base mb-md">
        <div className="w-9 h-9 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            home_pin
          </span>
        </div>
        <span className="font-headline-md text-headline-md text-primary">נחיתה רכה</span>
      </div>

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[540px] bg-white rounded-xl soft-shadow border border-surface-variant/30 overflow-hidden">

        {/* Card header — step indicator */}
        <div className="px-md pt-md pb-sm md:px-lg border-b border-surface-variant/20">
          {/* 3-segment bar */}
          <div className="flex gap-xs mb-sm">
            {STEPS.map((s, i) => (
              <div
                key={s.path}
                className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                  i + 1 <= step ? "bg-primary" : "bg-outline-variant/40"
                }`}
              />
            ))}
          </div>

          <div className="flex items-baseline justify-between">
            <span className="font-label-md text-label-md text-on-surface">
              {STEPS[step - 1].label}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              שלב {step} מתוך 3
            </span>
          </div>
        </div>

        {/* Card body — step content */}
        <div className="px-md pt-md pb-lg md:px-lg">
          <Outlet context={{ form, setForm }} />
        </div>
      </div>
    </div>
  );
}
