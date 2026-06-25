import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Spinner from "../components/Spinner";
import TaskCard from "../components/TaskCard";
import { api } from "../api";

export default function CategoryView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .items({ category: slug })
      .then((data) => alive && setItems(data))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const handleStatusChange = async (item, status) => {
    const key = `${item.item_type}:${item.item_id}`;
    setSavingId(key);
    try {
      const updated = await api.setStatus(item.item_type, item.item_id, {
        status,
        notes: item.notes ?? null,
        next_action: item.next_action ?? null,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.item_type === item.item_type && it.item_id === item.item_id ? updated : it
        )
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const label = items[0]?.category_label || "קטגוריה";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-md text-primary font-label-md flex items-center gap-xs hover:underline"
        >
          <span className="material-symbols-outlined">arrow_forward</span>
          חזרה ללוח הבקרה
        </button>

        <h1 className="font-headline-xl text-headline-xl text-primary mb-lg leading-tight text-right">
          {label}
        </h1>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md mb-md">{error}</div>
        )}

        {!loading && !items.length && !error && (
          <p className="text-on-surface-variant">אין פריטים בקטגוריה זו.</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {items.map((item) => (
            <TaskCard
              key={`${item.item_type}:${item.item_id}`}
              item={item}
              saving={savingId === `${item.item_type}:${item.item_id}`}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
