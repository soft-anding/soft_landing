import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import AskBox from "../components/AskBox";
import CategoryCard from "../components/CategoryCard";
import ProgressTimeline from "../components/ProgressTimeline";
import Spinner from "../components/Spinner";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";

function filterCategories(categories, interestCategories) {
  if (!interestCategories || interestCategories.includes("all")) return categories;
  return categories.filter((c) => interestCategories.includes(c.slug));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [progress, setProgress]     = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.progress(), api.categories()])
      .then(([p, c]) => {
        if (!alive) return;
        setProgress(p);
        setCategories(c);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const moveDate        = userProfile?.move_date        ?? null;
  const destinationCity = userProfile?.destination_city ?? null;
  const interestCats    = userProfile?.interest_categories ?? null;

  const visibleCategories = filterCategories(categories, interestCats);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">
        <section className="mb-lg text-right">
          <h1 className="font-headline-xl text-headline-xl text-primary mb-sm leading-tight">
            המסלול שלך למעבר רגוע
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            המשאית כבר על הדרך — הנה מה שצריך לעשות ומתי.
          </p>
        </section>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md">
            שגיאה בטעינת הנתונים: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <ProgressTimeline
              moveDate={moveDate}
              destinationCity={destinationCity}
              completed={progress?.completed ?? 0}
              total={progress?.total ?? 0}
              byStatus={progress?.by_status ?? {}}
            />

            <div className="flex justify-between items-center mb-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">קטגוריות</h2>
              {progress && (
                <span className="text-label-md text-on-surface-variant">
                  {progress.completed} מתוך {progress.total} הושלמו
                </span>
              )}
            </div>

            {visibleCategories.length === 0 ? (
              <p className="text-on-surface-variant font-body-md">
                לא נמצאו קטגוריות מתאימות להעדפות שלך.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                {visibleCategories.map((c) => (
                  <CategoryCard key={c.slug} category={c} />
                ))}
              </div>
            )}

            <AskBox
              profile={{}}
              seedQuery="מהן הזכויות וההנחות הרלוונטיות לי כמי שעובר/ת דירה?"
            />
          </>
        )}
      </main>

      <button
        onClick={() => navigate("/category/" + (visibleCategories[0]?.slug || ""))}
        className="fixed bottom-gutter left-gutter w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40"
        aria-label="עבור למשימות"
        disabled={!visibleCategories.length}
      >
        <span className="material-symbols-outlined text-3xl">checklist</span>
      </button>
    </div>
  );
}
