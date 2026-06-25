import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

// Built from the Stitch "נחיתה רכה - הרשמה" screen; the name input/CTA is
// replaced with a Google sign-in button.
export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-on-surface">
      {/* Decorative floating blobs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary-fixed-dim/20 rounded-full blur-[120px] floating-element"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-secondary-fixed/30 rounded-full blur-[100px] floating-element" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-gutter py-lg max-w-container-max mx-auto flex justify-between items-center">
        <div className="flex items-center gap-base">
          <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              home_pin
            </span>
          </div>
          <span className="font-headline-md text-headline-md text-primary">נחיתה רכה</span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-gutter py-xl">
        <div className="max-w-[720px] w-full text-center space-y-lg">
          <div className="space-y-sm">
            <h1 className="font-headline-lg text-headline-lg text-on-surface md:text-5xl md:leading-tight">
              עוברת דירה? <span className="text-primary">בואי נבנה לך נחיתה רכה</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-[540px] mx-auto leading-relaxed">
              נבנה לך מסלול אישי למעבר: משימות, דד־ליינים, זכויות ושירותים שכדאי לסגור כדי שהמעבר יעבור ברוגע.
            </p>
          </div>

          {/* Onboarding card */}
          <div className="bg-white rounded-xl p-md md:p-lg soft-shadow border border-surface-variant/30 text-right">
            <div className="flex items-start gap-md mb-lg">
              <div className="w-12 h-12 shrink-0 bg-secondary-fixed flex items-center justify-center rounded-full">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
              </div>
              <div className="space-y-xs">
                <p className="font-label-md text-label-md text-secondary">עוזרת המעבר האישית</p>
                <p className="font-body-md text-body-md text-on-surface">
                  היי! אני כאן כדי להפוך את המעבר שלך לפשוט יותר. התחברי כדי לשמור את ההתקדמות שלך.
                </p>
              </div>
            </div>

            <button
              onClick={handleGoogle}
              disabled={busy}
              className="w-full h-14 bg-primary-container hover:bg-primary text-white font-headline-md text-headline-md rounded-full soft-shadow transition-all duration-300 active:scale-95 flex items-center justify-center gap-sm disabled:opacity-60"
            >
              <GoogleIcon />
              <span>{busy ? "מתחברת…" : "התחברות עם Google"}</span>
            </button>

            {error && <p className="mt-md text-label-md text-error">{error}</p>}

            <div className="mt-lg pt-lg border-t border-surface-variant/20">
              <p className="text-label-md font-label-md text-on-surface-variant/60 mb-md">יעזור לך עם:</p>
              <div className="flex flex-wrap gap-sm justify-start">
                {[
                  ["inventory_2", "צ'קליסט מעבר"],
                  ["gavel", "זכויות והטבות"],
                  ["receipt_long", "ארנונה ותשלומים"],
                ].map(([icon, label]) => (
                  <div
                    key={label}
                    className="px-md py-sm bg-surface-container rounded-full border border-surface-variant/30 text-on-tertiary-container text-label-md flex items-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="pt-md opacity-60 flex items-center justify-center gap-lg">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined">verified_user</span>
              <span className="text-label-md">מאובטח ופרטי</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined">support_agent</span>
              <span className="text-label-md">ליווי אישי</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 w-full py-lg px-gutter flex flex-col items-center justify-center gap-md text-on-surface-variant">
        <p className="text-label-sm">© 2026 נחיתה רכה — המלווה האישי שלך למעבר דירה</p>
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 11.8 3 2 12.8 2 25s9.8 22 22 22c11 0 21-8 21-22 0-1.5-.2-2.7-.4-4.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7.1 29.6 5 24 5 16 5 9.1 9.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 36 26.7 37 24 37c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.1 40.5 16 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.3 36 45 31 45 25c0-1.5-.2-2.7-.4-4.5z"
      />
    </svg>
  );
}
