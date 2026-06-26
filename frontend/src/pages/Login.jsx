import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const FEATURES = [
  { icon: "fact_check",        title: "סדר ומשימות",   text: "רשימות מותאמות אישית כדי שלא תשכחו כלום." },
  { icon: "workspace_premium", title: "זכויות והטבות", text: "מידע על זכויות, הטבות והנחות שמגיעות לך במעבר." },
  { icon: "calendar_month",    title: "תכנון חכם",     text: "לוחות זמנים, טיפים ומשימות ששומרים אותך במסלול." },
];

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
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="w-full px-gutter pt-sm pb-xs flex justify-start">
        <div className="flex items-center gap-base">
          <div className="w-9 h-9 bg-primary-container rounded-lg flex items-center justify-center text-on-primary soft-shadow">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              home_pin
            </span>
          </div>
          <span className="font-headline-md text-headline-md text-primary">נחיתה רכה</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex flex-col justify-center gap-sm px-gutter min-h-0">
        <div className="max-w-container-max w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-lg items-center">

          {/* Text column (right side in RTL) */}
          <div className="space-y-md text-right">
            <div>
              <h1 className="font-headline-xl text-headline-xl text-on-surface leading-tight" style={{ fontSize: "48px", lineHeight: "56px" }}>עוברים דירה?</h1>
              <h1 className="font-headline-xl text-headline-xl text-primary leading-tight" style={{ fontSize: "48px", lineHeight: "56px" }}>בואו נעשה את זה ביחד!</h1>
            </div>

            <p className="font-body-md text-body-md text-on-surface-variant max-w-[480px]">
              נבנה לכם מסלול אישי למעבר: משימות, טיפים, רשימות ותזכורות - שיעזרו לכם לסגור כל פינה בראש שקט.
            </p>

            <div>
              <button
                onClick={handleGoogle}
                disabled={busy}
                className="inline-flex items-center gap-sm bg-primary-container hover:bg-primary text-on-primary font-label-md text-label-md px-lg py-sm rounded-full soft-shadow transition-all duration-300 active:scale-95 disabled:opacity-60"
              >
                <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                  <GoogleIcon size={16} />
                </span>
                {busy ? "מתחברת…" : "התחברות עם גוגל"}
              </button>

              {error && <p className="mt-xs font-label-md text-label-md text-error">{error}</p>}
            </div>
          </div>

          {/* Illustration column (left side in RTL) */}
          <div className="hidden lg:flex justify-center">
            <img src="/landing_page_package.png" alt="" className="w-full max-w-[600px]" />
          </div>
        </div>

        {/* Feature cards — full width, below the hero row */}
        <div className="max-w-container-max w-full mx-auto grid grid-cols-1 sm:grid-cols-3 gap-md">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded p-md soft-shadow border border-surface-variant/30 flex items-center gap-sm"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-lg">{f.icon}</span>
              </div>
              <div className="text-right">
                <h3 className="font-label-md text-label-md text-on-surface">{f.title}</h3>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full py-sm px-gutter flex flex-col items-center justify-center gap-xs">
        <p className="font-label-sm text-label-sm text-on-surface-variant">נחיתה רכה - המלווה האישי שלך למעבר דירה</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">
          ליצירת קשר: soft.landing.israel123@gmail.com
        </p>
      </footer>
    </div>
  );
}

function GoogleIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
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
