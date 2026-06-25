import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import CategoryCard from "../components/CategoryCard";
import ProgressTimeline from "../components/ProgressTimeline";
import Spinner from "../components/Spinner";
import { api } from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    return () => {
      alive = false;
    };
  }, []);

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

        {!loading && !error && progress && (
          <>
            <ProgressTimeline pct={progress.completed_pct} byStatus={progress.by_status} />

            <div className="flex justify-between items-center mb-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">קטגוריות</h2>
              <span className="text-label-md text-on-surface-variant">
                {progress.completed} מתוך {progress.total} הושלמו
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {categories.map((c) => (
                <CategoryCard key={c.slug} category={c} />
              ))}
            </div>
          </>
        )}
      </main>

      <button
        onClick={() => navigate("/category/" + (categories[0]?.slug || ""))}
        className="fixed bottom-gutter left-gutter w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-40"
        aria-label="עבור למשימות"
        disabled={!categories.length}
      >
        <span className="material-symbols-outlined text-3xl">checklist</span>
      </button>
    </div>
  );
}
