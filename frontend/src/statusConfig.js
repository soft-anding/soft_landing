// The 6 fixed statuses (spec §5) with display styling for chips.
// Keep in sync with the backend constants / DB CHECK constraint.
export const STATUSES = [
  "לא התחיל",
  "בבדיקה",
  "בטיפול",
  "הושלם",
  "לא רלוונטי",
  "ממתין לגורם חיצוני",
];

// Tailwind classes per status for the soft colored chips.
export const STATUS_STYLES = {
  "לא התחיל": "bg-surface-container text-on-surface-variant border-outline-variant",
  בבדיקה: "bg-tertiary-container/30 text-on-tertiary-container border-tertiary-container",
  בטיפול: "bg-secondary-container/50 text-on-secondary-container border-secondary-container",
  הושלם: "bg-primary text-on-primary border-primary",
  "לא רלוונטי": "bg-surface-dim text-on-surface-variant border-outline-variant",
  "ממתין לגורם חיצוני": "bg-primary-fixed text-on-primary-container border-primary-fixed-dim",
};

export const STATUS_ICON = {
  "לא התחיל": "radio_button_unchecked",
  בבדיקה: "search",
  בטיפול: "pending",
  הושלם: "check_circle",
  "לא רלוונטי": "block",
  "ממתין לגורם חיצוני": "hourglass_top",
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES["לא התחיל"];
}
