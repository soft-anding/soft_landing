import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

const THIS_YEAR = new Date().getFullYear();
// Birth year range: 15 to 86 years ago (1940–current-15)
const BIRTH_YEARS = Array.from(
  { length: THIS_YEAR - 15 - 1940 + 1 },
  (_, i) => THIS_YEAR - 15 - i
);

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

const s = {
  field:  { marginBottom: "1.5rem" },
  label:  { display: "block", fontWeight: "bold", marginBottom: "0.4rem" },
  input:  { width: "100%", padding: "0.4rem 0.6rem", fontSize: "1rem", boxSizing: "border-box" },
  error:  { color: "red", fontSize: "0.85rem", marginTop: "0.25rem" },
  footer: { display: "flex", justifyContent: "space-between", marginTop: "2rem" },
  back:   { padding: "0.7rem 2rem", fontSize: "1rem", cursor: "pointer", background: "none", border: "1px solid #ccc" },
  next:   { padding: "0.7rem 2.5rem", fontSize: "1rem", cursor: "pointer" },
  radios: { display: "flex", gap: "1.5rem" },
};

function YesNo({ id, value, onChange }) {
  return (
    <div style={s.radios}>
      {[{ v: "true", l: "כן" }, { v: "false", l: "לא" }].map(({ v, l }) => (
        <label key={v} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
          <input
            type="radio"
            name={id}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
          />
          {l}
        </label>
      ))}
    </div>
  );
}

export default function OnboardingStep2() {
  const { form, setForm } = useOutletContext();
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleNext(e) {
    e.preventDefault();
    const errs = {};
    if (!form.birth_year) errs.birth_year = "שדה חובה";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    navigate("/onboarding/step-3");
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <h1 style={{ marginBottom: "1.5rem" }}>קצת עלייך</h1>

      {/* Birth year */}
      <div style={s.field}>
        <label style={s.label} htmlFor="birth_year">שנת לידה *</label>
        <select
          id="birth_year"
          style={s.input}
          value={form.birth_year}
          onChange={(e) => set("birth_year", e.target.value)}
        >
          <option value="">בחרו שנה</option>
          {BIRTH_YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {errors.birth_year && <p style={s.error}>{errors.birth_year}</p>}
      </div>

      {/* Marital status */}
      <div style={s.field}>
        <label style={s.label} htmlFor="marital_status">מצב משפחתי</label>
        <select
          id="marital_status"
          style={s.input}
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
      <div style={s.field}>
        <label style={s.label} htmlFor="occupation">תעסוקה</label>
        <select
          id="occupation"
          style={s.input}
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
      <div style={s.field}>
        <label style={s.label} htmlFor="income_range">טווח הכנסה חודשית (נטו)</label>
        <select
          id="income_range"
          style={s.input}
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
      <div style={s.field}>
        <label style={{ ...s.label, marginBottom: "0.7rem" }}>יש לכם רכב?</label>
        <YesNo id="has_car" value={form.has_car} onChange={(v) => set("has_car", v)} />
      </div>

      <div style={s.footer}>
        <button type="button" style={s.back} onClick={() => navigate("/onboarding/step-1")}>
          → חזרה
        </button>
        <button type="submit" style={s.next}>הבא ←</button>
      </div>
    </form>
  );
}
