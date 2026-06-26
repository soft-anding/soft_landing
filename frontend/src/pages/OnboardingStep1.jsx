import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// ── Shared style tokens ───────────────────────────────────────────────────────
const field  = "mb-md";
const label  = "block font-label-md text-label-md text-on-surface mb-xs";
const select = "w-full border border-outline-variant rounded bg-white px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
const err    = "font-label-sm text-label-sm text-error mt-xs";

// ── Options ───────────────────────────────────────────────────────────────────
const CITY_OPTIONS = [
  { value: "jerusalem", label: "ירושלים" },
  { value: "tel_aviv",  label: "תל אביב–יפו" },
];

const COMPANIONS_OPTIONS = [
  { value: "alone",          label: "לבד" },
  { value: "with_roommates", label: "עם שותפים לדירה" },
  { value: "with_partner",   label: "עם בן/בת זוג" },
  { value: "with_family",    label: "עם משפחה" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingStep1() {
  const { form, setForm } = useOutletContext();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleNext(e) {
    e.preventDefault();
    const errs = {};
    if (!form.full_name)         errs.full_name        = "שדה חובה";
    if (!form.origin_city)       errs.origin_city       = "שדה חובה";
    if (!form.destination_city) errs.destination_city = "שדה חובה";
    if (!form.move_date)         errs.move_date        = "שדה חובה";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    navigate("/onboarding/step-2");
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <h2 className="font-headline-md text-headline-md text-on-surface text-center mb-xs">
        ספרו לנו על המעבר
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant text-center mb-md">
        המידע יעזור לנו לבנות עבורכם רשימת משימות מותאמת אישית.
      </p>

      {/* Full name */}
      <div className={field}>
        <label className={label} htmlFor="full_name">
          שם מלא <span className="text-error">*</span>
        </label>
        <input
          id="full_name"
          type="text"
          placeholder="הקלידו את שמכם"
          className={`${select} ${errors.full_name ? "border-error" : ""}`}
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
        />
        {errors.full_name && <p className={err}>{errors.full_name}</p>}
      </div>

      {/* Origin city */}
      <div className={field}>
        <label className={label} htmlFor="origin_city">
          מאיזו עיר אתם עוברים? <span className="text-error">*</span>
        </label>
        <select
          id="origin_city"
          className={`${select} ${errors.origin_city ? "border-error" : ""}`}
          value={form.origin_city}
          onChange={(e) => set("origin_city", e.target.value)}
        >
          <option value="" disabled hidden>בחרו עיר</option>
          {CITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.origin_city && <p className={err}>{errors.origin_city}</p>}
      </div>

      {/* Destination city */}
      <div className={field}>
        <label className={label} htmlFor="destination_city">
          לאיזו עיר אתם עוברים? <span className="text-error">*</span>
        </label>
        <select
          id="destination_city"
          className={`${select} ${errors.destination_city ? "border-error" : ""}`}
          value={form.destination_city}
          onChange={(e) => set("destination_city", e.target.value)}
        >
          <option value="" disabled hidden>בחרו עיר</option>
          {CITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.destination_city && <p className={err}>{errors.destination_city}</p>}
      </div>

      {/* Move date */}
      <div className={field}>
        <label className={label} htmlFor="move_date">
          מתי אתם עוברים (בערך)? <span className="text-error">*</span>
        </label>
        <input
          id="move_date"
          type="date"
          lang="en-GB"
          className={`${select} ${errors.move_date ? "border-error" : ""}`}
          value={form.move_date}
          onChange={(e) => set("move_date", e.target.value)}
        />
        {errors.move_date && <p className={err}>{errors.move_date}</p>}
      </div>

      {/* Moving companions */}
      <div className={field}>
        <label className={label} htmlFor="moving_companions">עם מי אתם עוברים?</label>
        <select
          id="moving_companions"
          className={select}
          value={form.moving_companions}
          onChange={(e) => set("moving_companions", e.target.value)}
        >
          <option value="" disabled hidden>בחרו</option>
          {COMPANIONS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-lg pt-md border-t border-surface-variant/30">
        <button
          type="button"
          onClick={async () => { await signOut(); navigate("/"); }}
          className="border border-outline-variant rounded-full px-lg py-sm font-label-md text-label-md text-on-surface-variant flex items-center gap-xs hover:bg-outline-variant/10 transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_forward</span>
          חזרה
        </button>
        <button
          type="submit"
          className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md hover:bg-primary/90 active:scale-95 transition-all duration-200 flex items-center gap-xs"
        >
          הבא
          <span className="material-symbols-outlined text-base">arrow_back</span>
        </button>
      </div>
    </form>
  );
}
