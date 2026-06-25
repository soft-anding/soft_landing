import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";

// Shared form state across all three steps. Initialised once when the user
// enters /onboarding; lives for the lifetime of the browser session (reset
// on page refresh, which is acceptable per spec).
export const EMPTY_FORM = {
  // Step 1
  origin_city:       "",
  destination_city:  "",
  move_date:         "",
  moving_companions: "",
  // Step 2
  birth_year:        "",
  marital_status:    "",
  occupation:        "",
  income_range:      "",
  has_car:           "",   // "" | "true" | "false"
  // Step 3
  needs_movers:          "",   // "" | "true" | "false"
  special_eligibility:   [],   // string[]
  interest_categories:   ["all"], // string[] | ["all"]
};

const STEP_LABELS = ["בסיסי המעבר", "עלייך", "פרטים נוספים"];

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
    <div dir="rtl" style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      {/* ── Step indicator ──────────────────────────────────────────── */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          שלב {step} מתוך 3 — {STEP_LABELS[step - 1]}
        </p>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: n <= step ? "#4f46e5" : "#e5e7eb",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content — receives form state via Outlet context */}
      <Outlet context={{ form, setForm }} />
    </div>
  );
}
