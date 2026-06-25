import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Spinner from "./Spinner";

/**
 * RAG-powered Q&A box.
 *
 * Props:
 *   profile  – UserProfile object forwarded to /api/ask
 *   seedQuery – optional string; if provided the box auto-runs this query on mount
 */
export default function AskBox({ profile = {}, seedQuery = "" }) {
  const [query, setQuery]     = useState(seedQuery);
  const [answer, setAnswer]   = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const inputRef              = useRef(null);

  // Auto-run the seed query once on mount
  useEffect(() => {
    if (seedQuery) runQuery(seedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runQuery(q) {
    const trimmed = (q || query).trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const res = await api.ask({ query: trimmed, profile });
      setAnswer(res.answer);
      setSources(res.sources || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runQuery(query);
  }

  return (
    <section className="mt-xl" dir="rtl">
      <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
        שאל/י אותנו
      </h2>

      <form onSubmit={handleSubmit} className="flex gap-sm mb-md">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="למשל: אילו הנחות בארנונה מגיעות לי?"
          className="flex-1 rounded-2xl border border-outline px-md py-sm
                     text-body-md text-on-surface bg-surface
                     focus:outline-none focus:ring-2 focus:ring-primary"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-2xl bg-primary text-white px-lg py-sm
                     font-label-lg text-label-lg
                     disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          שלח
        </button>
      </form>

      {loading && (
        <div className="flex items-center gap-sm text-on-surface-variant text-body-sm">
          <Spinner />
          <span>מחפש ומסנתז תשובה…</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-error-container text-on-error-container p-md text-body-md">
          שגיאה: {error}
        </div>
      )}

      {answer && (
        <div className="rounded-2xl bg-surface-variant p-lg space-y-md">
          {/* Answer */}
          <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
            {answer}
          </p>

          {/* Sources */}
          {sources.length > 0 && (
            <div>
              <p className="text-label-sm text-on-surface-variant mb-xs">מקורות:</p>
              <ul className="space-y-xs">
                {sources.map((s) => (
                  <li key={`${s.item_type}-${s.id}`} className="flex items-start gap-xs">
                    {!s.verified && (
                      <span className="shrink-0 text-xs bg-warning-container text-on-warning-container
                                       rounded px-1 py-0.5 leading-none mt-0.5">
                        טרם אומת
                      </span>
                    )}
                    {s.source_url ? (
                      <a
                        href={s.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-label-sm text-primary underline break-all"
                      >
                        {s.title_he || s.source_url}
                      </a>
                    ) : (
                      <span className="text-label-sm text-on-surface-variant">
                        {s.title_he}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
