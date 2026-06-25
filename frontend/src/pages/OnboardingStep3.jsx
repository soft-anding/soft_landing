import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { supabase } from "../supabaseClient";

const ELIGIBILITY_OPTIONS = [
  { value: "student",            label: "סטודנט/ית" },
  { value: "discharged_soldier", label: "מסיים/ת שירות סדיר או לאומי" },
  { value: "reservist",          label: "חייל/ת מילואים פעיל/ה" },
  { value: "single_parent",      label: "הורה יחידני/ת" },
  { value: "senior_citizen",     label: "אזרח/ית ותיק/ה" },
  { value: "new_immigrant",      label: "עולה חדש/ה" },
  { value: "disability",         label: "נכות מוכרת או זכאות מיוחדת" },
];

const s = {
  field:    { marginBottom: "1.5rem" },
  label:    { display: "block", fontWeight: "bold", marginBottom: "0.4rem" },
  hint:     { color: "#666", fontSize: "0.85rem", marginTop: "0.25rem" },
  error:    { color: "red", fontSize: "0.85rem", marginTop: "0.25rem" },
  checkRow: { display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.4rem" },
  radios:   { display: "flex", gap: "1.5rem" },
  footer:   { display: "flex", justifyContent: "space-between", marginTop: "2rem" },
  back:     { padding: "0.7rem 2rem", fontSize: "1rem", cursor: "pointer", background: "none", border: "1px solid #ccc" },
  submit:   { padding: "0.7rem 2.5rem", fontSize: "1rem", cursor: "pointer" },
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

export default function OnboardingStep3() {
  const { form, setForm } = useOutletContext();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories]     = useState([]);
  const [catsLoading, setCatsLoading]   = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState({});
  const [submitError, setSubmitError]   = useState(null);

  useEffect(() => {
    api.categories()
      .then((cats) => setCategories(cats || []))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false));
  }, []);

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
        return {
          ...f,
          interest_categories: f.interest_categories.includes("all") ? [] : ["all"],
        };
      }
      const withoutAll = f.interest_categories.filter((s) => s !== "all");
      const next = withoutAll.includes(slug)
        ? withoutAll.filter((s) => s !== slug)
        : [...withoutAll, slug];
      return { ...f, interest_categories: next };
    });
    setErrors((e) => ({ ...e, interest_categories: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = {};
    if (!form.interest_categories.length) {
      errs.interest_categories = "יש לבחור לפחות נושא אחד";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setSubmitError(null);

    // Build the complete row from all three steps' worth of data.
    const row = {
      id:                  user.id,
      origin_city:         form.origin_city        || null,
      destination_city:    form.destination_city   || null,
      move_date:           form.move_date           || null,
      moving_companions:   form.moving_companions   || null,
      birth_year:          form.birth_year ? parseInt(form.birth_year, 10) : null,
      marital_status:      form.marital_status      || null,
      occupation:          form.occupation          || null,
      income_range:        form.income_range        || null,
      has_car:             form.has_car      === "" ? null : form.has_car      === "true",
      needs_movers:        form.needs_movers === "" ? null : form.needs_movers === "true",
      special_eligibility: form.special_eligibility,
      interest_categories: form.interest_categories.length
        ? form.interest_categories
        : ["all"],
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

  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl">
      <h1 style={{ marginBottom: "1.5rem" }}>עוד כמה פרטים</h1>

      {/* Needs movers */}
      <div style={s.field}>
        <label style={{ ...s.label, marginBottom: "0.7rem" }}>
          אתם צריכים חברת הובלה?
        </label>
        <YesNo
          id="needs_movers"
          value={form.needs_movers}
          onChange={(v) => set("needs_movers", v)}
        />
      </div>

      {/* Special eligibility */}
      <div style={s.field}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ ...s.label, display: "block" }}>
            האם אחד מאלה מתאים לכם?
          </legend>
          <p style={s.hint}>
            נשתמש בזה רק כדי לבדוק זכויות פוטנציאליות — לא ישותף מחוץ לאפליקציה.
          </p>
          <div style={{ marginTop: "0.6rem" }}>
            {ELIGIBILITY_OPTIONS.map((o) => (
              <label key={o.value} style={s.checkRow}>
                <input
                  type="checkbox"
                  checked={form.special_eligibility.includes(o.value)}
                  onChange={() => toggleEligibility(o.value)}
                />
                {o.label}
              </label>
            ))}
            {/* "None of these" clears all selections */}
            <label style={s.checkRow}>
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

      {/* Topics of interest */}
      <div style={s.field}>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ ...s.label, display: "block" }}>
            אילו נושאים מעניינים אתכם? *
          </legend>

          {catsLoading ? (
            <p style={s.hint}>טוען נושאים…</p>
          ) : (
            <div style={{ marginTop: "0.6rem" }}>
              {/* Select all — prominent, first */}
              <label style={{ ...s.checkRow, fontWeight: "bold" }}>
                <input
                  type="checkbox"
                  checked={form.interest_categories.includes("all")}
                  onChange={() => toggleCategory("all")}
                />
                בחר/י הכל
              </label>
              <hr style={{ margin: "0.4rem 0" }} />
              {categories.map((c) => (
                <label key={c.slug} style={s.checkRow}>
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
            <p style={s.error}>{errors.interest_categories}</p>
          )}
        </fieldset>
      </div>

      {/* Submit error */}
      {submitError && (
        <p style={{ ...s.error, marginBottom: "1rem" }}>
          שגיאה בשמירה: {submitError}
        </p>
      )}

      <div style={s.footer}>
        <button
          type="button"
          style={s.back}
          onClick={() => navigate("/onboarding/step-2")}
          disabled={submitting}
        >
          → חזרה
        </button>
        <button
          type="submit"
          style={{ ...s.submit, opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer" }}
          disabled={submitting}
        >
          {submitting ? "שומר…" : "סיום ↪ לדשבורד"}
        </button>
      </div>
    </form>
  );
}
