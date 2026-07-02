import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import Spinner from "../components/Spinner";
import StatusSelect from "../components/StatusSelect";
import { api } from "../api";

function List({ title, icon, values }) {
  if (!values || !values.length) return null;
  return (
    <div className="mt-md">
      <h3 className="font-headline-md text-headline-md text-on-surface mb-sm flex items-center gap-xs">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        {title}
      </h3>
      <ul className="space-y-2">
        {values.map((v, i) => (
          <li key={i} className="flex items-start gap-sm bg-surface rounded-xl p-3">
            <span className="material-symbols-outlined text-primary text-base mt-0.5">check_small</span>
            <span className="font-body-md text-on-surface-variant text-right">
              {typeof v === "string" ? v : v.text || v.title || JSON.stringify(v)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function itemFromLocation(location, itemType, itemId) {
  const passed = location.state?.item;
  return passed && passed.item_type === itemType && String(passed.item_id) === String(itemId)
    ? passed
    : null;
}

export default function ItemDetail() {
  const { itemType, itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialItem = itemFromLocation(location, itemType, itemId);
  const [item, setItem] = useState(initialItem);
  const [loading, setLoading] = useState(!initialItem);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(initialItem?.status ?? null);
  const [notes, setNotes] = useState(initialItem?.notes || "");
  const [nextAction, setNextAction] = useState(initialItem?.next_action || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function listFrom(values) {
    const vals = (values || []).map((v) => (typeof v === "string" ? v : v.url || v.text || v.title || ""));
    return vals.length ? vals : [""];
  }

  const [actionSteps, setActionSteps] = useState(listFrom(initialItem?.action_steps));
  const [relatedLinks, setRelatedLinks] = useState(listFrom(initialItem?.links));
  const [savingContent, setSavingContent] = useState(false);
  const [contentSaved, setContentSaved] = useState(false);

  function updateListItem(list, setList, index, value) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  function addListItem(list, setList) {
    setList([...list, ""]);
  }

  function removeListItem(list, setList, index) {
    const next = list.filter((_, i) => i !== index);
    setList(next.length ? next : [""]);
  }

  useEffect(() => {
    let alive = true;
    // If we already got the full item via navigation state (e.g. from "עמוד מלא"
    // on a TaskCard), show it immediately with no spinner, then refresh quietly
    // in the background — instead of always re-fetching from scratch first.
    const passed = itemFromLocation(location, itemType, itemId);
    if (!passed) setLoading(true);

    api
      .items({ type: itemType })
      .then((data) => {
        if (!alive) return;
        const found = data.find((i) => String(i.item_id) === String(itemId));
        if (!found) {
          setError("הפריט לא נמצא.");
          return;
        }
        setItem(found);
        setStatus(found.status);
        setNotes(found.notes || "");
        setNextAction(found.next_action || "");
        setActionSteps(listFrom(found.action_steps));
        setRelatedLinks(listFrom(found.links));
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [itemType, itemId]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.setStatus(itemType, Number(itemId), {
        status,
        notes: notes || null,
        next_action: nextAction || null,
      });
      setItem(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cleanList = (list) => {
    const vals = list.map((v) => v.trim()).filter(Boolean);
    return vals.length ? vals : null;
  };

  const saveContent = async () => {
    setSavingContent(true);
    setContentSaved(false);
    try {
      const updated = await api.setCustomTaskContent(Number(itemId), {
        action_steps: cleanList(actionSteps),
        related_links: cleanList(relatedLinks),
      });
      setItem(updated);
      setContentSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingContent(false);
    }
  };

  const links = (item?.links || []).filter(Boolean);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-md text-primary font-label-md flex items-center gap-xs hover:underline"
        >
          <span className="material-symbols-outlined">arrow_forward</span>
          חזרה
        </button>

        {loading && <Spinner />}
        {error && (
          <div className="bg-error-container text-on-error-container rounded-2xl p-md mb-md">{error}</div>
        )}

        {item && (
          <div className="flex flex-col lg:flex-row gap-md lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)]">
            {/* Main content */}
            <div className="lg:w-2/3 bg-white rounded-2xl p-lg shadow-sm soft-shadow text-right lg:h-full lg:overflow-y-auto">
              <span className="text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                {item.item_type === "rights_item" ? "זכות / הטבה" : "משימה"} · {item.category_label}
              </span>
              <h1 className="font-headline-xl text-headline-xl text-primary mt-sm mb-md leading-tight">
                {item.title_he}
              </h1>
              {item.summary && (
                <p className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-line">
                  {item.summary}
                </p>
              )}

              {item.discount_amount && (
                <div className="mt-md bg-secondary-container/30 rounded-xl p-3 font-body-md text-on-secondary-container">
                  💰 {item.discount_amount}
                </div>
              )}
              {item.deadlines && (
                <div className="mt-sm bg-tertiary-container/20 rounded-xl p-3 font-body-md text-on-tertiary-container">
                  🗓️ {item.deadlines}
                </div>
              )}

              {item.is_custom ? (
                <div className="mt-md space-y-md">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-sm flex items-center gap-xs">
                      <span className="material-symbols-outlined text-primary">checklist</span>
                      שלבי פעולה
                    </h3>
                    <div className="space-y-xs">
                      {actionSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-xs">
                          <input
                            type="text"
                            dir="rtl"
                            value={step}
                            onChange={(e) => updateListItem(actionSteps, setActionSteps, i, e.target.value)}
                            placeholder="לדוגמה: להתקשר לעירייה"
                            className="flex-1 rounded border-2 border-surface-variant bg-surface-bright px-3 py-2 input-pill font-body-md text-right"
                          />
                          {actionSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeListItem(actionSteps, setActionSteps, i)}
                              aria-label="הסר שלב"
                              className="text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addListItem(actionSteps, setActionSteps)}
                      className="mt-xs flex items-center gap-xs font-label-sm text-label-sm text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      הוספת שלב
                    </button>
                  </div>

                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-sm flex items-center gap-xs">
                      <span className="material-symbols-outlined text-primary">link</span>
                      קישורים
                    </h3>
                    <div className="space-y-xs">
                      {relatedLinks.map((link, i) => (
                        <div key={i} className="flex items-center gap-xs">
                          <input
                            type="text"
                            dir="rtl"
                            value={link}
                            onChange={(e) => updateListItem(relatedLinks, setRelatedLinks, i, e.target.value)}
                            placeholder="https://…"
                            className="flex-1 rounded border-2 border-surface-variant bg-surface-bright px-3 py-2 input-pill font-body-md text-right"
                          />
                          {relatedLinks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeListItem(relatedLinks, setRelatedLinks, i)}
                              aria-label="הסר קישור"
                              className="text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addListItem(relatedLinks, setRelatedLinks)}
                      className="mt-xs flex items-center gap-xs font-label-sm text-label-sm text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">add</span>
                      הוספת קישור
                    </button>
                  </div>

                  <button
                    onClick={saveContent}
                    disabled={savingContent}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-on-primary rounded-full font-label-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-xs"
                  >
                    {savingContent ? "שומר…" : "שמירה"}
                  </button>
                  {contentSaved && <p className="text-primary text-label-md text-center">נשמר ✓</p>}
                </div>
              ) : (
                <>
                  <List title="שלבי פעולה" icon="checklist" values={item.action_steps} />
                  <List title="תנאי זכאות" icon="rule" values={item.eligibility_conditions} />
                  <List title="מסמכים נדרשים" icon="folder" values={item.required_documents} />

                  {links.length > 0 && (
                    <div className="mt-md">
                      <h3 className="font-headline-md text-headline-md text-on-surface mb-sm flex items-center gap-xs">
                        <span className="material-symbols-outlined text-primary">link</span>
                        מקורות וקישורים
                      </h3>
                      <ul className="space-y-2">
                        {links.map((l, i) => {
                          const href = typeof l === "string" ? l : l.url || l.href;
                          const text = typeof l === "string" ? l : l.text || l.title || href;
                          if (!href) return null;
                          return (
                            <li key={i}>
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-xs break-all"
                              >
                                <span className="material-symbols-outlined text-base">open_in_new</span>
                                {text}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tracking panel */}
            <aside className="lg:w-1/3 bg-white rounded-2xl p-lg shadow-sm soft-shadow text-right lg:h-full lg:overflow-y-auto">
              <h2 className="font-headline-md text-headline-md text-on-surface mb-md">המעקב שלי</h2>

              <label className="block font-label-md text-on-surface-variant mb-xs">סטטוס</label>
              {status && <StatusSelect value={status} onChange={setStatus} disabled={saving} />}

              <label className="block font-label-md text-on-surface-variant mt-md mb-xs">פעולה הבאה</label>
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="מה השלב הבא?"
                className="w-full rounded-full border-2 border-surface-variant bg-surface-bright px-4 py-2 input-pill font-body-md"
              />

              <label className="block font-label-md text-on-surface-variant mt-md mb-xs">הערות</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="הערות אישיות…"
                className="w-full rounded-2xl border-2 border-surface-variant bg-surface-bright px-4 py-3 input-pill font-body-md resize-none"
              />

              <button
                onClick={save}
                disabled={saving}
                className="mt-md w-full h-12 bg-primary hover:bg-primary/90 text-on-primary rounded-full font-label-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-xs"
              >
                {saving ? "שומר…" : "שמירה"}
              </button>
              {saved && <p className="mt-sm text-primary text-label-md text-center">נשמר ✓</p>}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
