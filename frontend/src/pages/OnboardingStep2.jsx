import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

// ── Shared style tokens ───────────────────────────────────────────────────────
const fieldCls  = "mb-md";
const labelCls  = "block font-label-md text-label-md text-on-surface mb-xs";
const inputCls  = "w-full border border-outline-variant rounded bg-white px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
const errCls    = "font-label-sm text-label-sm text-error mt-xs";

// ── Birth year validation ─────────────────────────────────────────────────────
const MIN_YEAR = 1930;
const MAX_YEAR = 2015;

function validateBirthYear(val) {
  const trimmed = (val || "").trim();
  if (!trimmed) return "שדה חובה";
  if (!/^\d{4}$/.test(trimmed)) return "יש להזין שנה בת 4 ספרות";
  const n = parseInt(trimmed, 10);
  if (n < MIN_YEAR || n > MAX_YEAR) return `שנה חייבת להיות בין ${MIN_YEAR} ל-${MAX_YEAR}`;
  return null;
}

// ── Options ───────────────────────────────────────────────────────────────────
const MARITAL_OPTIONS = [
  { value: "single",          label: "רווק/ה" },
  { value: "in_relationship", label: "בזוגיות" },
  { value: "married",         label: "נשוי/אה" },
  { value: "divorced",        label: "גרוש/ה" },
  { value: "widowed",         label: "אלמן/ה" },
];

const OCCUPATION_OPTIONS = [
  { value: "employee",      label: "שכיר/ה" },
  { value: "self_employed", label: "עצמאי/ת" },
  { value: "student",       label: "סטודנט/ית" },
  { value: "unemployed",    label: "לא עובד/ת כעת" },
  { value: "other",         label: "אחר" },
];

const INCOME_OPTIONS = [
  { value: "under_6000",        label: "עד ₪6,000" },
  { value: "6000_10000",        label: "₪6,000 – ₪10,000" },
  { value: "10000_15000",       label: "₪10,000 – ₪15,000" },
  { value: "15000_20000",       label: "₪15,000 – ₪20,000" },
  { value: "over_20000",        label: "₪20,000 ומעלה" },
  { value: "prefer_not_to_say", label: "מעדיף/ה לא לציין" },
];

// ── Yes/No radio group ────────────────────────────────────────────────────────
function YesNo({ id, value, onChange }) {
  return (
    <div className="flex gap-md">
      {[{ v: "true", l: "כן" }, { v: "false", l: "לא" }].map(({ v, l }) => (
        <label
          key={v}
          className="flex items-center gap-sm cursor-pointer text-body-md font-body-md text-on-surface"
        >
          <input
            type="radio"
            name={id}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="text-primary border-outline-variant focus:ring-primary focus:ring-2 h-4 w-4"
          />
          {l}
        </label>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingStep2() {
  const { form, setForm } = useOutletContext();
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  function set(fieldName, value) {
    setForm((f) => ({ ...f, [fieldName]: value }));
    setErrors((e) => ({ ...e, [fieldName]: undefined }));
  }

  // Validate birth year on blur so the user gets instant feedback
  function handleBirthYearBlur() {
    const msg = validateBirthYear(form.birth_year);
    setErrors((e) => ({ ...e, birth_year: msg ?? undefined }));
  }

  function handleNext(e) {
    e.preventDefault();
    const birthErr = validateBirthYear(form.birth_year);
    if (birthErr) {
      setErrors((prev) => ({ ...prev, birth_year: birthErr }));
      return;
    }
    navigate("/onboarding/step-3");
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
        קצת עלייך
      </h2>

      {/* Birth year — plain number input */}
      <div className={fieldCls}>
        <label className={labelCls} htmlFor="birth_year">
          שנת לידה <span className="text-error">*</span>
        </label>
        <input
          id="birth_year"
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="לדוגמה: 1992"
          className={`${inputCls} ${errors.birth_year ? "border-error focus:border-error" : ""}`}
          value={form.birth_year}
          onChange={(e) => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={handleBirthYearBlur}
          dir="ltr"
        />
        {errors.birth_year && <p className={errCls}>{errors.birth_year}</p>}
        {!errors.birth_year && (
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">
            בין {MIN_YEAR} ל-{MAX_YEAR}
          </p>
        )}
      </div>

      {/* Marital status */}
      <div className={fieldCls}>
        <label className={labelCls} htmlFor="marital_status">מצב משפחתי</label>
        <select
          id="marital_status"
          className={inputCls}
          value={form.marital_status}
          onChange={(e) => set("marital_status", e.target.value)}
        >
          <option value="">בחרו</option>
          {MARITAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Occupation */}
      <div className={fieldCls}>
        <label className={labelCls} htmlFor="occupation">תעסוקה</label>
        <select
          id="occupation"
          className={inputCls}
          value={form.occupation}
          onChange={(e) => set("occupation", e.target.value)}
        >
          <option value="">בחרו</option>
          {OCCUPATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Income range */}
      <div className={fieldCls}>
        <label className={labelCls} htmlFor="income_range">
          טווח הכנסה חודשית (נטו)
        </label>
        <select
          id="income_range"
          className={inputCls}
          value={form.income_range}
          onChange={(e) => set("income_range", e.target.value)}
        >
          <option value="">בחרו</option>
          {INCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Has car */}
      <div className={fieldCls}>
        <p className={`${labelCls} mb-sm`}>יש לכם רכב?</p>
        <YesNo id="has_car" value={form.has_car} onChange={(v) => set("has_car", v)} />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-lg pt-md border-t border-surface-variant/30">
        <button
          type="button"
          onClick={() => navigate("/onboarding/step-1")}
          className="font-label-md text-label-md text-primary flex items-center gap-xs hover:underline"
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
