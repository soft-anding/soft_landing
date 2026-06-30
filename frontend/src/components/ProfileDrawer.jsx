import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../supabaseClient";
import { api } from "../api";
import SideDrawer from "./SideDrawer";

const EXCLUDED_TOPIC_CATEGORIES = new Set([
  "אריזה והובלה",
  "הכנת הבית החדש",
  "פינוי הבית הישן",
  "פינוי דירה ישנה",
  "בירוקרטיה של עיריות",
  "בירוקרטיה ממשלתית",
  "parking_permit",
]);

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

const ELIGIBILITY_OPTIONS = [
  { value: "student",            label: "סטודנט/ית" },
  { value: "discharged_soldier", label: "מסיים/ת שירות סדיר או לאומי" },
  { value: "reservist",          label: "חייל/ת מילואים פעיל/ה" },
  { value: "single_parent",      label: "הורה יחידני/ת" },
  { value: "senior_citizen",     label: "אזרח/ית ותיק/ה" },
  { value: "new_immigrant",      label: "עולה חדש/ה" },
  { value: "disability",         label: "נכות מוכרת או זכאות מיוחדת" },
];

function boolToStr(v) {
  if (v === true)  return "true";
  if (v === false) return "false";
  return "";
}

function profileToForm(profile) {
  return {
    full_name:           profile.full_name          || "",
    origin_city:         profile.origin_city        || "",
    destination_city:    profile.destination_city   || "",
    move_date:           profile.move_date          || "",
    moving_companions:   profile.moving_companions  || "",
    birth_year:          profile.birth_year != null ? String(profile.birth_year) : "",
    marital_status:      profile.marital_status     || "",
    occupation:          profile.occupation         || "",
    income_range:        profile.income_range       || "",
    has_car:             boolToStr(profile.has_car),
    needs_movers:        boolToStr(profile.needs_movers),
    special_eligibility: profile.special_eligibility || [],
    interest_categories: profile.interest_categories || [],
  };
}

const fieldCls     = "mb-md";
const labelCls     = "block font-label-md text-label-md text-on-surface mb-xs";
const inputCls     = "w-full border border-outline-variant rounded bg-white px-4 py-3 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
const checkCls     = "text-primary border-outline-variant focus:ring-primary focus:ring-2 rounded-sm h-4 w-4 shrink-0 accent-primary";
const checkRowCls  = "flex items-center gap-sm cursor-pointer font-body-md text-body-md text-on-surface py-xs hover:bg-surface-container-low rounded px-xs transition-colors";
const sectionCls   = "mb-lg";
const secTitleCls  = "font-label-md text-label-md text-on-surface-variant uppercase tracking-wide mb-sm pb-xs border-b border-outline-variant/30";

function YesNo({ id, value, onChange }) {
  return (
    <div className="flex gap-md">
      {[{ v: "true", l: "כן" }, { v: "false", l: "לא" }].map(({ v, l }) => (
        <label key={v} className="flex items-center gap-sm cursor-pointer font-body-md text-body-md text-on-surface">
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

export default function ProfileDrawer({ open, onClose }) {
  const { user, userProfile, refreshProfile } = useAuth();
  const [form, setForm]           = useState(() => profileToForm(userProfile || {}));
  const [categories, setCategories] = useState([]);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved]         = useState(false);

  const [tgRequesting, setTgRequesting] = useState(false);
  const [tgAwaiting, setTgAwaiting]     = useState(false);
  const [tgError, setTgError]           = useState(null);
  const telegramConnected = Boolean(userProfile?.telegram_chat_id);

  // Re-sync form whenever the drawer opens or the loaded profile changes
  useEffect(() => {
    if (open && userProfile) {
      setForm(profileToForm(userProfile));
      setSaved(false);
      setSaveError(null);
    }
  }, [open, userProfile]);

  // Load categories once on first open
  useEffect(() => {
    if (!open || categories.length > 0) return;
    api.categories()
      .then((cats) => setCategories((cats || []).filter((c) => !EXCLUDED_TOPIC_CATEGORIES.has(c.slug))))
      .catch(() => {});
  }, [open]);

  // While waiting for the user to hit Start in the bot, poll the profile so
  // "מחובר/ת" appears as soon as the Telegram webhook links the chat.
  useEffect(() => {
    if (!open || !tgAwaiting || telegramConnected) return;
    const interval = setInterval(refreshProfile, 3000);
    return () => clearInterval(interval);
  }, [open, tgAwaiting, telegramConnected]);

  useEffect(() => {
    if (telegramConnected) setTgAwaiting(false);
  }, [telegramConnected]);

  async function handleConnectTelegram() {
    setTgRequesting(true);
    setTgError(null);
    try {
      const { deep_link } = await api.getTelegramLinkCode();
      window.open(deep_link, "_blank", "noopener,noreferrer");
      setTgAwaiting(true);
    } catch (e) {
      setTgError(e.message);
    } finally {
      setTgRequesting(false);
    }
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
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
    setSaved(false);
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
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const row = {
      full_name:           form.full_name          || null,
      origin_city:         form.origin_city        || null,
      destination_city:    form.destination_city   || null,
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

    const { error } = await supabase
      .from("user_profiles")
      .update(row)
      .eq("id", user.id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSaved(true);
  }

  const allCatsSelected = form.interest_categories.includes("all");

  return (
    <SideDrawer open={open} onClose={onClose} title="הפרופיל שלי">
      <form onSubmit={handleSave} noValidate>

        {/* ── Move details ─────────────────────────────── */}
        <div className={sectionCls}>
          <p className={secTitleCls}>פרטי המעבר</p>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-full_name">שם מלא</label>
            <input
              id="p-full_name"
              type="text"
              className={inputCls}
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-origin_city">מאיזו עיר אתם עוברים?</label>
            <select
              id="p-origin_city"
              className={inputCls}
              value={form.origin_city}
              onChange={(e) => set("origin_city", e.target.value)}
            >
              <option value="">בחרו עיר</option>
              {CITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-destination_city">לאיזו עיר אתם עוברים?</label>
            <select
              id="p-destination_city"
              className={inputCls}
              value={form.destination_city}
              onChange={(e) => set("destination_city", e.target.value)}
            >
              <option value="">בחרו עיר</option>
              {CITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-move_date">מתי אתם עוברים?</label>
            <input
              id="p-move_date"
              type="date"
              className={inputCls}
              value={form.move_date}
              onChange={(e) => set("move_date", e.target.value)}
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-moving_companions">עם מי אתם עוברים?</label>
            <select
              id="p-moving_companions"
              className={inputCls}
              value={form.moving_companions}
              onChange={(e) => set("moving_companions", e.target.value)}
            >
              <option value="">בחרו</option>
              {COMPANIONS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Personal details ─────────────────────────── */}
        <div className={sectionCls}>
          <p className={secTitleCls}>פרטים אישיים</p>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-birth_year">שנת לידה</label>
            <input
              id="p-birth_year"
              type="text"
              inputMode="numeric"
              maxLength={4}
              dir="rtl"
              className={inputCls}
              value={form.birth_year}
              onChange={(e) => set("birth_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-marital_status">מצב משפחתי</label>
            <select
              id="p-marital_status"
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

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-occupation">תעסוקה</label>
            <select
              id="p-occupation"
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

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="p-income_range">טווח הכנסה חודשית (נטו)</label>
            <select
              id="p-income_range"
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

          <div className={fieldCls}>
            <p className={`${labelCls} mb-sm`}>יש לכם רכב?</p>
            <YesNo id="p-has_car" value={form.has_car} onChange={(v) => set("has_car", v)} />
          </div>
        </div>

        {/* ── Additional details ───────────────────────── */}
        <div className={sectionCls}>
          <p className={secTitleCls}>פרטים נוספים</p>

          <div className={fieldCls}>
            <p className={`${labelCls} mb-sm`}>אתם צריכים חברת הובלה?</p>
            <YesNo id="p-needs_movers" value={form.needs_movers} onChange={(v) => set("needs_movers", v)} />
          </div>

          <div className={fieldCls}>
            <p className={labelCls}>האם אחד מאלה מתאים לכם?</p>
            <div className="border border-outline-variant/50 rounded p-sm space-y-xs">
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
                  onChange={() => set("special_eligibility", [])}
                />
                אף אחד מאלה
              </label>
            </div>
          </div>

          {categories.length > 0 && (
            <div className={fieldCls}>
              <p className={labelCls}>נושאים מעניינים</p>
              <div className="border border-outline-variant/50 rounded overflow-hidden">
                <label className="flex items-center gap-sm px-sm py-sm bg-surface-container-low border-b border-outline-variant/30 cursor-pointer font-label-md text-label-md text-on-surface">
                  <input
                    type="checkbox"
                    className={checkCls}
                    checked={allCatsSelected}
                    onChange={() => toggleCategory("all")}
                  />
                  בחר/י הכל
                </label>
                <div className="max-h-52 overflow-y-auto p-sm space-y-xs">
                  {categories.map((c) => (
                    <label key={c.slug} className={checkRowCls}>
                      <input
                        type="checkbox"
                        className={checkCls}
                        checked={allCatsSelected || form.interest_categories.includes(c.slug)}
                        onChange={() => toggleCategory(c.slug)}
                      />
                      {c.label_he}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Telegram notifications ───────────────────── */}
        <div className={sectionCls}>
          <p className={secTitleCls}>התראות בטלגרם</p>
          {telegramConnected ? (
            <p className="flex items-center gap-xs font-body-md text-body-md text-on-surface">
              <span className="material-symbols-outlined text-base text-primary">check_circle</span>
              מחובר/ת לבוט הטלגרם
            </p>
          ) : (
            <div className={fieldCls}>
              <p className="font-body-md text-body-md text-on-surface-variant mb-sm">
                קבלו את ההתראות מהמערכת גם בטלגרם.
              </p>
              <button
                type="button"
                onClick={handleConnectTelegram}
                disabled={tgRequesting}
                className="border border-outline-variant text-on-surface px-md py-sm rounded-full font-label-sm text-label-sm hover:bg-surface-container-low active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {tgRequesting ? "מתחבר…" : "התחבר לבוט הטלגרם"}
              </button>
              {tgAwaiting && (
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-xs">
                  פתחו את הצ׳אט עם הבוט ולחצו Start — הסטטוס כאן יתעדכן אוטומטית.
                </p>
              )}
              {tgError && (
                <p className="font-label-sm text-label-sm text-error mt-xs">שגיאה: {tgError}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Feedback messages ────────────────────────── */}
        {saveError && (
          <div className="bg-error-container text-on-error-container rounded px-md py-sm font-label-sm text-label-sm mb-md">
            שגיאה בשמירה: {saveError}
          </div>
        )}

        {saved && (
          <div className="bg-primary-container text-on-primary-container rounded px-md py-sm font-label-sm text-label-sm mb-md flex items-center gap-xs">
            <span className="material-symbols-outlined text-base">check_circle</span>
            הפרופיל עודכן בהצלחה
          </div>
        )}

        {/* ── Save button ──────────────────────────────── */}
        <div className="pt-md mt-md border-t border-outline-variant/30 flex justify-center">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary/90 text-on-primary px-lg py-sm rounded-full font-label-sm text-label-sm hover:bg-primary active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {saving ? "שומר…" : "שמור שינויים"}
          </button>
        </div>

      </form>
    </SideDrawer>
  );
}
