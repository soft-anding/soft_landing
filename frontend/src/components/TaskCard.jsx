import { useNavigate } from "react-router-dom";
import StatusSelect from "./StatusSelect";

// A single catalog item with an inline status selector.
export default function TaskCard({ item, onStatusChange, saving }) {
  const navigate = useNavigate();
  const done = item.status === "הושלם";
  const typeLabel = item.item_type === "rights_item" ? "זכות / הטבה" : "משימה";

  return (
    <div
      className={`bg-white rounded-2xl p-md shadow-sm hover:shadow-md transition-shadow flex flex-col gap-sm border-r-4 ${
        done ? "border-primary" : "border-primary-container"
      } ${done ? "opacity-80" : ""}`}
    >
      <div className="flex justify-between items-start gap-sm">
        <span className="text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant whitespace-nowrap">
          {typeLabel}
        </span>
        <h3 className="font-headline-md text-headline-md text-on-surface text-right flex-1">
          {item.title_he || "ללא כותרת"}
        </h3>
      </div>

      {item.summary && (
        <p className="font-body-md text-body-md text-on-surface-variant line-clamp-3 text-right">
          {item.summary}
        </p>
      )}

      <div className="flex flex-wrap justify-between items-center gap-sm mt-auto pt-sm">
        <button
          onClick={() => navigate(`/item/${item.item_type}/${item.item_id}`)}
          className="text-primary font-label-md flex items-center gap-xs hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          פרטים נוספים
        </button>
        <StatusSelect
          value={item.status}
          disabled={saving}
          onChange={(s) => onStatusChange(item, s)}
        />
      </div>
    </div>
  );
}
