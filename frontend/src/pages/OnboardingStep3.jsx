import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";
import { supabase } from "../supabaseClient";

// ── Shared style tokens ───────────────────────────────────────────────────────
const fieldCls   = "mb-md";
const labelCls   = "block font-label-md text-label-md text-on-surface mb-xs";
const hintCls    = "font-label-sm text-label-sm text-on-surface-variant mt-xs";
const errCls     = "font-label-sm text-label-sm text-error mt-xs";
const checkCls   = "text-primary border-outline-variant focus:ring-primary focus:ring-2 rounded h-4 w-4 shrink-0 accent-primary";
const checkRowCls = "flex items-center gap-sm cursor-pointer font-body-md text-body-md text-on-surface py-xs hover:bg-surface-container-low rounded px-xs transition-colors";

// ── Eligibility options ───────────────────────────────────────────────────────
const ELIGIBILITY_OPTIONS = [
  { value: "student",            label: "סטודנט/ית" },
  { value: "discharged_soldier", label: "מסיים/ת שירות סדיר או לאומי" },
  { value: "reservist",          label: "חייל/ת מילואים פעיל/ה" },
  { value: "single_parent",      label: "הורה יחידני/ת" },
  { value: "senior_citizen",     label: "אזרח/ית ותיק/ה" },
  { value: "new_immigrant",      label: "עולה חדש/ה" },
  { value: "disability",         label: "נכות מוכרת או זכאות מיוחדת" },
];

// ── Yes/No radio group ────────────────────────────────────────────────────────
function YesNo({ id, value, onChange }) {
  return (
    <div className="flex gap-md">
      {[{ v: "true", l: "כן" }, { v: "false", l: "לא" }].map(({ v, l }) => (
        <label
          key={v}
          className="flex items-center gap-sm cursor-pointer font-body-md text-body-md text-on-surface"
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
export default function OnboardingStep3() {
  const { form, setForm }                 = useOutletContext();
  const { user, refreshProfile }          = useAuth();
  const navigate                          = useNavigate();

  const [categories, setCategories]       = useState([]);
  const [catsLoading, setCatsLoading]     = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState({});
  const [submitError, setSubmitError]     = useState(null);

  useEffect(() => {
    api.categories()
      .then((cats) => setCategories(cats || []))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false));
  }, []);

  function set(fieldName, value) {
    setForm((f) => ({ ...f, [fieldName]: value }));
    setErrors((e) => ({ ...e, [fieldName]: undefined }));
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

    const row = {
      id:                  user.id,
      origin_city:         form.origin_city       || null,
      destination_city:    form.destination_city  || null,
      move_date:           form.move_date          || null,
      moving_companions:   form.moving_companions  || null,
      birth_year:          form.birth_year ? parseInt(form.birth_year, 10) : null,
      marital_status:      form.marital_status     || null,
      occupation:          form.occupation         || null,
      income_range:        form.income_range       || null,
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

  const allSelected = form.interest_categories.includes("all");

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
        עוד כמה פרטים
      </h2>

      {/* Needs movers */}
      <div className={fieldCls}>
        <p className={`${labelCls} mb-sm`}>אתם צריכים חברת הובלה?</p>
        <YesNo
          id="needs_movers"
          value={form.needs_movers}
          onChange={(v) => set("needs_movers", v)}
        />
      </div>

      {/* Special eligibility */}
      <div className={fieldCls}>
        <p className={labelCls}>האם אחד מאלה מתאים לכם?</p>
        <p className={hintCls}>
          נשתמש בזה רק כדי לבדוק זכויות פוטנציאליות — לא ישותף מחוץ לאפליקציה.
        </p>
        <div className="mt-sm border border-outline-variant/50 rounded p-sm space-y-xs">
          {ELIGIBILITY_OPTIONS.map((o) => (
            <label key={o.value} className={checkRowCls}>
              <input
                type="checkbox"
                className={checkCls}
                checked={form.special_eligibility.includes(o.value)}
                onChange={() => toggleEligibility(o.value)}
              />
              {o.label}
            </label>
          ))}
          <hr className="border-outline-variant/30" />
          <label className={checkRowCls}>
            <input
              type="checkbox"
              className={checkCls}
              checked={form.special_eligibility.length === 0}
              onChange={() => setForm((f) => ({ ...f, special_eligibility: [] }))}
            />
            אף אחד מאלה
          </label>
        </div>
      </div>

      {/* Topics of interest */}
      <div className={fieldCls}>
        <p className={labelCls}>
          אילו נושאים מעניינים אתכם? <span className="text-error">*</span>
        </p>

        {catsLoading ? (
          <p className={hintCls}>טוען נושאים…</p>
        ) : (
          <div className="border border-outline-variant/50 rounded overflow-hidden">
            {/* Select all — sticky header row */}
            <label className="flex items-center gap-sm px-sm py-sm bg-surface-container-low border-b border-outline-variant/30 cursor-pointer font-label-md text-label-md text-on-surface">
              <input
                type="checkbox"
                className={checkCls}
                checked={allSelected}
                onChange={() => toggleCategory("all")}
              />
              בחר/י הכל
            </label>

            {/* Scrollable category list */}
            <div className="max-h-52 overflow-y-auto p-sm space-y-xs">
              {categories.map((c) => (
                <label key={c.slug} className={checkRowCls}>
                  <input
                    type="checkbox"
                    className={checkCls}
                    checked={allSelected || form.interest_categories.includes(c.slug)}
                    onChange={() => toggleCategory(c.slug)}
                  />
                  {c.label_he}
                </label>
              ))}
              {categories.length === 0 && (
                <p className={hintCls}>לא נמצאו קטגוריות — ניתן להמשיך עם "בחר הכל"</p>
              )}
            </div>
          </div>
        )}

        {errors.interest_categories && (
          <p className={errCls}>{errors.interest_categories}</p>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-error-container text-on-error-container rounded px-md py-sm font-label-sm text-label-sm mb-md">
          שגיאה בשמירה: {submitError}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-lg pt-md border-t border-surface-variant/30">
        <button
          type="button"
          onClick={() => navigate("/onboarding/step-2")}
          disabled={submitting}
          className="font-label-md text-label-md text-primary flex items-center gap-xs hover:underline disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">arrow_forward</span>
          חזרה
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-on-primary px-lg py-sm rounded-full font-label-md text-label-md hover:bg-primary/90 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-xs"
        >
          {submitting ? "שומר…" : "סיום"}
          {!submitting && (
            <span className="material-symbols-outlined text-base">check_circle</span>
          )}
        </button>
      </div>
    </form>
  );
}
