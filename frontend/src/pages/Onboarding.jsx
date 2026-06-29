import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { supabase } from "../supabaseClient";

const EXCLUDED_TOPIC_CATEGORIES = new Set([
  "אריזה והובלה",
  "הכנת הבית החדש",
  "פינוי הבית הישן",
  "פינוי דירה ישנה",
  "בירוקרטיה של עיריות",
  "בירוקרטיה ממשלתית",
  "parking_permit",
]);

// ── Static option maps ────────────────────────────────────────────────────────

const DESTINATION_OPTIONS = [
  { value: "jerusalem", label: "ירושלים" },
  { value: "tel_aviv",  label: "תל אביב–יפו" },
];

const MARITAL_OPTIONS = [
  { value: "single",          label: "רווק/ה" },
  { value: "in_relationship", label: "בזוגיות" },
  { value: "married",         label: "נשוי/אה" },
  { value: "divorced",        label: "גרוש/ה" },
  { value: "widowed",         label: "אלמן/ה" },
];

const COMPANIONS_OPTIONS = [
  { value: "alone",          label: "לבד" },
  { value: "with_roommates", label: "עם שותפים לדירה" },
  { value: "with_partner",   label: "עם בן/בת זוג" },
  { value: "with_family",    label: "עם משפחה" },
];

const OCCUPATION_OPTIONS = [
  { value: "employee",      label: "שכיר/ה" },
  { value: "self_employed", label: "עצמאי/ת" },
  { value: "student",       label: "סטודנט/ית" },
  { value: "unemployed",    label: "לא עובד/ת כעת" },
  { value: "other",         label: "אחר" },
];

const INCOME_OPTIONS = [
  { value: "under_6000",       label: "עד ₪6,000" },
  { value: "6000_10000",       label: "₪6,000 – ₪10,000" },
  { value: "10000_15000",      label: "₪10,000 – ₪15,000" },
  { value: "15000_20000",      label: "₪15,000 – ₪20,000" },
  { value: "over_20000",       label: "₪20,000 ומעלה" },
  { value: "prefer_not_to_say",label: "מעדיף/ה לא לציין" },
];

const RENTAL_OPTIONS = [
  { value: "renting", label: "שוכר/ת" },
  { value: "buying",  label: "קונה" },
];

const ELIGIBILITY_OPTIONS = [
  { value: "student",           label: "סטודנט/ית" },
  { value: "discharged_soldier",label: "מ除役חייל / מסיים שירות לאומי" },
  { value: "reservist",         label: "חייל/ת מילואים פעיל/ה" },
  { value: "single_parent",     label: "הורה יחידני/ת" },
  { value: "senior_citizen",    label: "אזרח/ית ותיק/ה" },
  { value: "new_immigrant",     label: "עולה חדש/ה" },
  { value: "disability",        label: "נכות מוכרת או זכאות מיוחדת" },
];

// Current year for birth_year range
const THIS_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: THIS_YEAR - 1940 - 15 }, (_, i) => THIS_YEAR - 15 - i);

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  origin_city:          "",
  destination_city:     "",
  move_date:            "",
  birth_year:           "",
  marital_status:       "",
  moving_companions:    "",
  occupation:           "",
  income_range:         "",
  rental_or_buy:        "",
  contract_signed:      "",   // "" | "true" | "false"
  has_car:              "",
  needs_movers:         "",
  phone_number:         "",
  special_eligibility:  [],   // string[]
  interest_categories:  ["all"], // string[] | ["all"]
};

function YesNo({ id, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "1.5rem" }}>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]             = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);  // [{slug, label_he}]
  const [catsLoading, setCatsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});
  const [submitError, setSubmitError] = useState(null);

  // Fetch dynamic categories from the backend catalog
  useEffect(() => {
    api.categories()
      .then((cats) => setCategories((cats || []).filter((c) => !EXCLUDED_TOPIC_CATEGORIES.has(c.slug))))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false));
  }, []);

  // ── Field helpers ─────────────────────────────────────────────────────────

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function toggleEligibility(value) {
    setForm((f) => {
      const cur = f.special_eligibility;
      return {
        ...f,
        special_eligibility: cur.includes(value)
          ? cur.filter((v) => v !== value)
          : [...cur, value],
      };
    });
  }

  function toggleCategory(slug) {
    setForm((f) => {
      if (slug === "all") {
        // Toggle "select all": if already all, clear to empty; else set to all
        return { ...f, interest_categories: f.interest_categories.includes("all") ? [] : ["all"] };
      }
      const withoutAll = f.interest_categories.filter((s) => s !== "all");
      const next = withoutAll.includes(slug)
        ? withoutAll.filter((s) => s !== slug)
        : [...withoutAll, slug];
      return { ...f, interest_categories: next };
    });
    setErrors((e) => ({ ...e, interest_categories: undefined }));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const e = {};
    if (!form.destination_city) e.destination_city = "שדה חובה";
    if (!form.move_date)         e.move_date        = "שדה חובה";
    if (!form.birth_year)        e.birth_year       = "שדה חובה";
    if (!form.interest_categories.length)
      e.interest_categories = "יש לבחור לפחות נושא אחד";
    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setSubmitError(null);

    const row = {
      id:                   user.id,
      origin_city:          form.origin_city       || null,
      destination_city:     form.destination_city  || null,
      move_date:            form.move_date          || null,
      birth_year:           form.birth_year ? parseInt(form.birth_year, 10) : null,
      marital_status:       form.marital_status     || null,
      moving_companions:    form.moving_companions  || null,
      occupation:           form.occupation         || null,
      income_range:         form.income_range       || null,
      has_car:              form.has_car      === "" ? null : form.has_car      === "true",
      rental_or_buy:        form.rental_or_buy      || null,
      contract_signed:      form.contract_signed=== "" ? null : form.contract_signed === "true",
      needs_movers:         form.needs_movers  === "" ? null : form.needs_movers  === "true",
      phone_number:         form.phone_number        || null,
      special_eligibility:  form.special_eligibility,
      interest_categories:  form.interest_categories.length ? form.interest_categories : ["all"],
    };

    const { error } = await supabase.from("user_profiles").insert(row);
    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    navigate("/dashboard", { replace: true });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const fieldStyle = { marginBottom: "1.5rem" };
  const labelStyle = { display: "block", fontWeight: "bold", marginBottom: "0.4rem" };
  const inputStyle = { width: "100%", padding: "0.4rem 0.6rem", fontSize: "1rem", boxSizing: "border-box" };
  const errorStyle = { color: "red", fontSize: "0.85rem", marginTop: "0.25rem" };
  const hintStyle  = { color: "#666", fontSize: "0.85rem", marginTop: "0.25rem" };

  return (
    <div dir="rtl" style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>ספרו לנו קצת על המעבר שלכם</h1>
      <p style={{ color: "#555", marginBottom: "2rem" }}>
        נשתמש בפרטים כדי להתאים עבורכם את המידע הרלוונטי ביותר.
        כל השדות אופציונליים למעט אלה המסומנים ב-*
      </p>

      <form onSubmit={handleSubmit} noValidate>

        {/* 1. Origin city */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="origin_city">מאיזו עיר אתם עוברים?</label>
          <input
            id="origin_city"
            type="text"
            style={inputStyle}
            value={form.origin_city}
            onChange={(e) => set("origin_city", e.target.value)}
            placeholder="לדוגמה: חיפה"
          />
        </div>

        {/* 2. Destination city */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="destination_city">
            לאיזו עיר אתם עוברים? *
          </label>
          <select
            id="destination_city"
            style={inputStyle}
            value={form.destination_city}
            onChange={(e) => set("destination_city", e.target.value)}
          >
            <option value="">בחרו עיר</option>
            {DESTINATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.destination_city && <p style={errorStyle}>{errors.destination_city}</p>}
        </div>

        {/* 3. Move date */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="move_date">מתי אתם עוברים (בערך)? *</label>
          <input
            id="move_date"
            type="date"
            style={inputStyle}
            value={form.move_date}
            onChange={(e) => set("move_date", e.target.value)}
          />
          {errors.move_date && <p style={errorStyle}>{errors.move_date}</p>}
        </div>

        {/* 4. Birth year */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="birth_year">שנת לידה *</label>
          <select
            id="birth_year"
            style={inputStyle}
            value={form.birth_year}
            onChange={(e) => set("birth_year", e.target.value)}
          >
            <option value="">בחרו שנה</option>
            {BIRTH_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {errors.birth_year && <p style={errorStyle}>{errors.birth_year}</p>}
        </div>

        {/* 5. Marital status */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="marital_status">מצב משפחתי</label>
          <select
            id="marital_status"
            style={inputStyle}
            value={form.marital_status}
            onChange={(e) => set("marital_status", e.target.value)}
          >
            <option value="">בחרו</option>
            {MARITAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 6. Moving companions */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="moving_companions">עם מי אתם עוברים?</label>
          <select
            id="moving_companions"
            style={inputStyle}
            value={form.moving_companions}
            onChange={(e) => set("moving_companions", e.target.value)}
          >
            <option value="">בחרו</option>
            {COMPANIONS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 7. Occupation */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="occupation">תעסוקה</label>
          <select
            id="occupation"
            style={inputStyle}
            value={form.occupation}
            onChange={(e) => set("occupation", e.target.value)}
          >
            <option value="">בחרו</option>
            {OCCUPATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 8. Income range */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="income_range">טווח הכנסה חודשית (נטו)</label>
          <select
            id="income_range"
            style={inputStyle}
            value={form.income_range}
            onChange={(e) => set("income_range", e.target.value)}
          >
            <option value="">בחרו</option>
            {INCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 9. Renting or buying */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="rental_or_buy">שוכרים או קונים?</label>
          <select
            id="rental_or_buy"
            style={inputStyle}
            value={form.rental_or_buy}
            onChange={(e) => set("rental_or_buy", e.target.value)}
          >
            <option value="">בחרו</option>
            {RENTAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 10. Contract signed */}
        <div style={fieldStyle}>
          <label style={{ ...labelStyle, marginBottom: "0.7rem" }}>
            החוזה/הסכם כבר נחתם?
          </label>
          <YesNo
            id="contract_signed"
            value={form.contract_signed}
            onChange={(v) => set("contract_signed", v)}
          />
        </div>

        {/* 11. Has car */}
        <div style={fieldStyle}>
          <label style={{ ...labelStyle, marginBottom: "0.7rem" }}>יש לכם רכב?</label>
          <YesNo id="has_car" value={form.has_car} onChange={(v) => set("has_car", v)} />
        </div>

        {/* 12. Needs movers */}
        <div style={fieldStyle}>
          <label style={{ ...labelStyle, marginBottom: "0.7rem" }}>
            אתם צריכים חברת הובלה?
          </label>
          <YesNo
            id="needs_movers"
            value={form.needs_movers}
            onChange={(v) => set("needs_movers", v)}
          />
        </div>

        {/* 13. Phone number */}
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="phone_number">מספר טלפון (אופציונלי)</label>
          <input
            id="phone_number"
            type="tel"
            style={inputStyle}
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            placeholder="050-0000000"
            dir="ltr"
          />
          <p style={hintStyle}>לתזכורות אוטומטיות — פיצ׳ר זה בשלב הדגמה ועדיין אינו פעיל.</p>
        </div>

        {/* 14. Special eligibility */}
        <div style={fieldStyle}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, display: "block" }}>
              האם אחד מאלה מתאים לכם?
            </legend>
            <p style={hintStyle}>
              נשתמש בזה רק כדי לבדוק זכויות פוטנציאליות — לא ישותף מחוץ לאפליקציה.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.6rem" }}>
              {ELIGIBILITY_OPTIONS.map((o) => (
                <label key={o.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.special_eligibility.includes(o.value)}
                    onChange={() => toggleEligibility(o.value)}
                  />
                  {o.label}
                </label>
              ))}
              {/* "None of these" clears all selections */}
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.special_eligibility.length === 0}
                  onChange={() => setForm((f) => ({ ...f, special_eligibility: [] }))}
                />
                אף אחד מאלה
              </label>
            </div>
          </fieldset>
        </div>

        {/* 15. Topics of interest — dynamic from backend */}
        <div style={fieldStyle}>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, display: "block" }}>
              אילו נושאים מעניינים אתכם? *
            </legend>
            {catsLoading ? (
              <p style={hintStyle}>טוען נושאים…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.6rem" }}>
                {/* Select all — prominent, first */}
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontWeight: "bold" }}>
                  <input
                    type="checkbox"
                    checked={form.interest_categories.includes("all")}
                    onChange={() => toggleCategory("all")}
                  />
                  בחר/י הכל
                </label>
                <hr style={{ margin: "0.3rem 0" }} />
                {categories.map((c) => (
                  <label key={c.slug} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={
                        form.interest_categories.includes("all") ||
                        form.interest_categories.includes(c.slug)
                      }
                      onChange={() => toggleCategory(c.slug)}
                    />
                    {c.label_he}
                  </label>
                ))}
              </div>
            )}
            {errors.interest_categories && (
              <p style={errorStyle}>{errors.interest_categories}</p>
            )}
          </fieldset>
        </div>

        {/* Submit */}
        {submitError && (
          <p style={{ ...errorStyle, marginBottom: "1rem" }}>
            שגיאה בשמירה: {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.7rem 2.5rem",
            fontSize: "1rem",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "שומר…" : "המשיכו לדשבורד"}
        </button>
      </form>
    </div>
  );
}
