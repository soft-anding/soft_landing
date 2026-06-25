import { useNavigate } from "react-router-dom";

// Icon + accent per category slug (sage/coral/blue rotation from the Stitch grid).
const CATEGORY_META = {
  government_registry: { icon: "account_balance", accent: "border-primary" },
  municipal: { icon: "location_city", accent: "border-tertiary-container" },
  utilities: { icon: "bolt", accent: "border-secondary-container" },
  communication_services: { icon: "wifi", accent: "border-primary-container" },
  financial: { icon: "payments", accent: "border-secondary-container" },
  rights_general: { icon: "gavel", accent: "border-tertiary-container" },
  arnona_general: { icon: "receipt_long", accent: "border-primary" },
  arnona_discount: { icon: "savings", accent: "border-secondary-container" },
  parking_permit: { icon: "local_parking", accent: "border-tertiary-container" },
  senior_benefits: { icon: "elderly", accent: "border-primary-container" },
  address_update: { icon: "mail", accent: "border-primary" },
  other: { icon: "category", accent: "border-outline-variant" },
};

export default function CategoryCard({ category }) {
  const navigate = useNavigate();
  const meta = CATEGORY_META[category.slug] || CATEGORY_META.other;

  return (
    <button
      onClick={() => navigate(`/category/${category.slug}`)}
      className={`text-right bg-white rounded-2xl p-md shadow-sm hover:shadow-md transition-shadow flex flex-col gap-sm border-r-4 ${meta.accent}`}
    >
      <div className="flex justify-between items-center">
        <span className="material-symbols-outlined text-primary bg-primary-container/20 p-2 rounded-xl">
          {meta.icon}
        </span>
        <h3 className="font-headline-md text-headline-md text-on-surface">{category.label_he}</h3>
      </div>
      <div className="flex justify-between items-center mt-2 text-on-surface-variant">
        <span className="material-symbols-outlined">arrow_back</span>
        <span className="font-body-md">{category.count} פריטים</span>
      </div>
    </button>
  );
}
