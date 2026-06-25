import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

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

const s = {
  field:  { marginBottom: "1.5rem" },
  label:  { display: "block", fontWeight: "bold", marginBottom: "0.4rem" },
  input:  { width: "100%", padding: "0.4rem 0.6rem", fontSize: "1rem", boxSizing: "border-box" },
  error:  { color: "red", fontSize: "0.85rem", marginTop: "0.25rem" },
  footer: { display: "flex", justifyContent: "flex-end", marginTop: "2rem" },
  next:   { padding: "0.7rem 2.5rem", fontSize: "1rem", cursor: "pointer" },
};

export default function OnboardingStep1() {
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
    if (!form.destination_city) errs.destination_city = "שדה חובה";
    if (!form.move_date)         errs.move_date        = "שדה חובה";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    navigate("/onboarding/step-2");
  }

  return (
    <form onSubmit={handleNext} noValidate>
      <h1 style={{ marginBottom: "1.5rem" }}>ספרו לנו על המעבר</h1>

      {/* Origin city */}
      <div style={s.field}>
        <label style={s.label} htmlFor="origin_city">מאיזו עיר אתם עוברים?</label>
        <select
          id="origin_city"
          style={s.input}
          value={form.origin_city}
          onChange={(e) => set("origin_city", e.target.value)}
        >
          <option value="">בחרו עיר</option>
          {CITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Destination city */}
      <div style={s.field}>
        <label style={s.label} htmlFor="destination_city">
          לאיזו עיר אתם עוברים? *
        </label>
        <select
          id="destination_city"
          style={s.input}
          value={form.destination_city}
          onChange={(e) => set("destination_city", e.target.value)}
        >
          <option value="">בחרו עיר</option>
          {CITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.destination_city && <p style={s.error}>{errors.destination_city}</p>}
      </div>

      {/* Move date */}
      <div style={s.field}>
        <label style={s.label} htmlFor="move_date">
          מתי אתם עוברים (בערך)? *
        </label>
        <input
          id="move_date"
          type="date"
          style={s.input}
          value={form.move_date}
          onChange={(e) => set("move_date", e.target.value)}
        />
        {errors.move_date && <p style={s.error}>{errors.move_date}</p>}
      </div>

      {/* Moving companions */}
      <div style={s.field}>
        <label style={s.label} htmlFor="moving_companions">עם מי אתם עוברים?</label>
        <select
          id="moving_companions"
          style={s.input}
          value={form.moving_companions}
          onChange={(e) => set("moving_companions", e.target.value)}
        >
          <option value="">בחרו</option>
          {COMPANIONS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={s.footer}>
        <button type="submit" style={s.next}>הבא ←</button>
      </div>
    </form>
  );
}
