import { useState } from "react";
import { api } from "../api";

const CATEGORIES = [
  { value: "government_registry",    label: "ממשל וכתובת רשמית" },
  { value: "municipal",              label: "עירייה" },
  { value: "utilities",              label: "חשבונות וספקי שירות" },
  { value: "communication_services", label: "תקשורת: אינטרנט וטלוויזיה" },
  { value: "financial",              label: "כספים ותשלומים" },
  { value: "logistics",              label: "לוגיסטיקה ומעבר" },
  { value: "household_setup",        label: "סידור הבית" },
  { value: "education",              label: "חינוך" },
  { value: "other",                  label: "כללי" },
  { value: "__custom__",             label: "קטגוריה חדשה…" },
];

const DEADLINE_OPTIONS = [
  { value: "before_move",   label: "לפני המעבר" },
  { value: "move_day",      label: "יום המעבר" },
  { value: "after_move",    label: "אחרי המעבר" },
  { value: "specific_date", label: "תאריך ספציפי" },
];

const EMPTY = {
  title: "",
  description: "",
  category: "other",
  customCategory: "",
  deadline_type: "before_move",
  deadline_date: "",
};

export default function AddCustomTaskModal({ onClose, onTaskCreated }) {
  const [form,   setForm]   = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isCustomCategory = form.category === "__custom__";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (isCustomCategory && !form.customCategory.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const effectiveCategory = isCustomCategory
        ? form.customCategory.trim()
        : form.category || null;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: effectiveCategory,
        deadline_type: form.deadline_type,
        deadline_date:
          form.deadline_type === "specific_date" ? form.deadline_date || null : null,
      };
      const created = await api.createCustomTask(payload);
      onTaskCreated(created);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl soft-shadow w-full max-w-2xl text-right overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant/20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">הוספת משימה אישית</h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="סגור"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Form — scrollable if the screen is very short */}
        <form
          onSubmit={handleSubmit}
          className="px-lg py-md overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 4rem)" }}
        >
          <div className="space-y-md">

            {/* Title — full width */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-xs">
                כותרת <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="לדוגמה: לעדכן כתובת במוסד חינוך"
                className="w-full px-md py-2 rounded-xl border border-outline-variant font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Category + Deadline — side by side */}
            <div className="grid grid-cols-2 gap-md items-start">

              {/* Category — left column */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-xs">
                  קטגוריה
                </label>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full px-md py-2 rounded-xl border border-outline-variant font-body-md text-body-md text-on-surface bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>

                {/* Free-text input — appears only when "קטגוריה חדשה" is selected */}
                {isCustomCategory && (
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={80}
                    value={form.customCategory}
                    onChange={(e) => set("customCategory", e.target.value)}
                    placeholder="שם הקטגוריה…"
                    className="mt-xs w-full px-md py-2 rounded-xl border border-primary font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                )}
              </div>

              {/* Deadline type — right column */}
              <div>
                <p className="font-label-md text-label-md text-on-surface mb-xs">מתי צריך לבצע?</p>
                <div className="grid grid-cols-2 gap-xs">
                  {DEADLINE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center justify-center gap-xs px-sm py-2 rounded-xl border cursor-pointer transition-colors font-label-sm text-label-sm text-center ${
                        form.deadline_type === opt.value
                          ? "border-primary bg-primary-container/20 text-primary"
                          : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deadline_type"
                        value={opt.value}
                        checked={form.deadline_type === opt.value}
                        onChange={() => set("deadline_type", opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {/* Date picker — appears only for specific_date */}
                {form.deadline_type === "specific_date" && (
                  <input
                    type="date"
                    value={form.deadline_date}
                    onChange={(e) => set("deadline_date", e.target.value)}
                    className="mt-xs w-full px-md py-2 rounded-xl border border-outline-variant font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                )}
              </div>
            </div>

            {/* Description — full width */}
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-xs">
                פרטים נוספים (אופציונלי)
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="הוסיפו פרטים, תזכורות, קישורים…"
                className="w-full px-md py-2 rounded-xl border border-outline-variant font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
              />
            </div>

            {error && (
              <p className="font-label-sm text-label-sm text-error">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-sm pt-sm border-t border-outline-variant/20">
              <button
                type="submit"
                disabled={saving || !form.title.trim() || (isCustomCategory && !form.customCategory.trim())}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md transition-opacity disabled:opacity-50"
              >
                {saving ? "שומר…" : "הוסף משימה"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-lg py-2 rounded-xl border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:border-primary/40 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
