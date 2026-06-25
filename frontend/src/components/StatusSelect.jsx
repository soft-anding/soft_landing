import { STATUSES, STATUS_ICON, statusStyle } from "../statusConfig";

// A pill <select> for choosing one of the 7 fixed statuses.
export default function StatusSelect({ value, onChange, disabled }) {
  return (
    <label className={`inline-flex items-center gap-xs rounded-full border px-3 py-1.5 ${statusStyle(value)}`}>
      <span className="material-symbols-outlined text-base">{STATUS_ICON[value] || "radio_button_unchecked"}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 focus:ring-0 text-label-md font-label-md cursor-pointer p-0 pe-5"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
