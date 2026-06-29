import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export function TaskAgentFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="התייעצות עם סוכן AI"
      className="fixed bottom-6 left-6 z-[60] w-14 h-14 rounded-full bg-green-800 text-white flex items-center justify-center shadow-lg hover:bg-green-900 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 256 256">
        <path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,224h0ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216ZM88,112a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,112Zm0,32a8,8,0,0,1,8-8h64a8,8,0,1,1,0,16H96A8,8,0,0,1,88,144Z"></path>
      </svg>
    </button>
  );
}

const GREETING =
  "היי! אני העוזר האישי שלך למעבר. אני כאן כדי לעזור לך לעשות סדר במשימות, להבין מה דחוף ומה אפשר לדחות, ולענות על כל שאלה לגבי התהליך. במה אפשר לעזור?";

// Strip {"reply":"..."} wrapper that the model sometimes produces.
// Works both on the complete JSON (after stream) and mid-stream partial text.
function unwrapReply(text) {
  if (!text || !text.trimStart().startsWith("{")) return text;
  // Complete JSON — parse and extract.
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string") return parsed.reply;
  } catch {}
  // Mid-stream — strip the known prefix/suffix manually so display is clean
  // even before the full JSON token is received.
  const prefix = '{"reply":"';
  if (text.startsWith(prefix)) {
    let inner = text.slice(prefix.length);
    if (inner.endsWith('"}'))      inner = inner.slice(0, -2);
    else if (inner.endsWith('"'))  inner = inner.slice(0, -1);
    return inner.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return text;
}

// Extract [SUGGEST_DAILY:{...}] from text and return { clean, suggestion }.
// Returns { clean: originalText, suggestion: null } if no annotation found.
function parseSuggestion(text) {
  const match = text.match(/\[SUGGEST_DAILY:(\{.*?\})\]/s);
  if (!match) return { clean: text, suggestion: null };
  try {
    const suggestion = JSON.parse(match[1]);
    const clean = text.replace(match[0], "").trimEnd();
    return { clean, suggestion };
  } catch {
    return { clean: text, suggestion: null };
  }
}

export default function TaskAgentChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, pendingSuggestion]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    function onOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", text: GREETING }]);
    }
  }, [open, messages.length]);

  if (!open) return null;

  function handleConfirmSuggestion() {
    if (!pendingSuggestion) return;
    window.dispatchEvent(
      new CustomEvent("daily-board-pin", { detail: { tasks: pendingSuggestion.tasks } })
    );
    setPendingSuggestion(null);
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text && !file) return;
    const userText = file ? `${text} 📎 ${file.name}`.trim() : text;
    const nextMessages = [...messages, { role: "user", text: userText }];
    setMessages(nextMessages);
    setInput("");
    setFile(null);
    setPendingSuggestion(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    try {
      await api.streamTaskAgentChat(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        (_chunk, full) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", text: unwrapReply(full) };
            return updated;
          });
        }
      );
      // Stream finished — unwrap JSON reply format, then parse suggestion annotation.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role !== "assistant" || !last.text) return prev;
        const { clean, suggestion } = parseSuggestion(unwrapReply(last.text));
        if (suggestion) {
          setPendingSuggestion(suggestion);
          return [...prev.slice(0, -1), { ...last, text: clean }];
        }
        if (clean !== last.text) return [...prev.slice(0, -1), { ...last, text: clean }];
        return prev;
      });
      window.dispatchEvent(new Event("tasks-changed"));
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: "מצטערים, הייתה שגיאה בפנייה לסוכן. נסו שוב.",
        };
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  async function handleEndConversation() {
    const hasUserMessages = messages.some((m) => m.role === "user");
    if (!hasUserMessages) {
      setMessages([]);
      setPendingSuggestion(null);
      onClose();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveTaskAgentConversation(
        messages.map((m) => ({ role: m.role, content: m.text }))
      );
      setMessages([]);
      setPendingSuggestion(null);
      onClose();
    } catch (err) {
      setSaveError(err.message || "שגיאה לא ידועה");
      setSaving(false);
    }
  }

  return (
    <div
      ref={panelRef}
      dir="rtl"
      className="fixed bottom-6 left-6 z-[60] w-[340px] h-[460px] bg-white rounded-2xl soft-shadow border border-outline-variant/30 flex flex-col overflow-hidden"
    >
      <div className="relative px-md py-sm border-b border-outline-variant/30 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-sm right-sm w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
        {saveError ? (
          <div className="absolute top-sm left-sm flex items-center gap-xs">
            <span className="font-label-sm text-label-sm text-red-600 max-w-[140px] truncate" title={saveError}>
              שגיאה: {saveError}
            </span>
            <button
              type="button"
              onClick={() => { setSaveError(null); setMessages([]); setPendingSuggestion(null); onClose(); }}
              className="px-xs py-0.5 rounded-full border border-red-400 text-red-600 font-label-sm text-label-sm hover:bg-red-50 transition-colors text-xs"
            >
              סגור
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEndConversation}
            disabled={saving || sending}
            className="absolute top-sm left-sm px-sm py-1 rounded-full border border-green-700 text-green-700 font-label-sm text-label-sm hover:bg-green-50 transition-colors disabled:opacity-60"
          >
            {saving ? "שומר..." : "סיום ושמירת השיחה"}
          </button>
        )}
        <div className="pr-4 pl-lg">
          <h3 className="font-label-md text-label-md font-bold text-on-surface text-right">
            העוזר האישי שלך למעבר
          </h3>
          <p className="font-label-sm text-label-sm text-on-surface-variant text-right">
            אני כאן כדי לעזור לך לעשות סדר במשימות
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-md py-md space-y-xs">
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const isTyping = sending && isLast && m.role === "assistant" && !m.text;
          const showSuggestion = pendingSuggestion && isLast && m.role === "assistant" && !sending;

          return (
            <div key={i}>
              <div className="flex">
                <div
                  dir="rtl"
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed text-black text-right break-words ${
                    m.role === "user"
                      ? "bg-white border border-gray-300 mr-auto"
                      : "bg-gray-100 ml-auto"
                  }`}
                >
                  {isTyping ? "…" : m.text}
                </div>
              </div>

              {/* Daily board suggestion confirmation card */}
              {showSuggestion && (
                <div className="flex justify-end mt-xs">
                  <div className="bg-primary-container/20 border border-primary/25 rounded-xl px-sm py-sm flex items-center gap-sm max-w-[80%]">
                    <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: "1.1rem" }}>
                      event_note
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface flex-1">
                      להוסיף ללוח היומי?
                    </span>
                    <button
                      onClick={() => setPendingSuggestion(null)}
                      className="font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors shrink-0"
                    >
                      לא
                    </button>
                    <button
                      onClick={handleConfirmSuggestion}
                      className="font-label-sm text-label-sm text-white bg-primary hover:bg-primary/90 transition-colors rounded-lg px-sm py-xs shrink-0"
                    >
                      כן, הוסף
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {file && (
        <div className="flex items-center gap-xs mx-md mb-xs px-sm py-1 rounded-lg bg-surface-container font-label-sm text-label-sm text-on-surface-variant w-fit shrink-0">
          <span className="material-symbols-outlined text-sm">attach_file</span>
          <span>{file.name}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            className="material-symbols-outlined text-sm hover:text-error"
            aria-label="הסר קובץ"
          >
            close
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-xs px-md py-sm border-t border-outline-variant/20 shrink-0">
        <textarea
          ref={textareaRef}
          dir="rtl"
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="כתבו הודעה…"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="flex-1 px-md py-1.5 rounded-xl border border-outline-variant text-xs text-right text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none overflow-y-auto leading-snug [&::-webkit-scrollbar]:hidden"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center hover:bg-surface-container transition-colors"
          aria-label="הוסף תמונה או קובץ"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </button>

        <button
          type="submit"
          disabled={sending || (!input.trim() && !file)}
          className="shrink-0 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 transition-opacity"
          aria-label="שלח"
        >
          <span className="material-symbols-outlined text-sm" style={{ transform: "scaleX(-1)" }}>
            send
          </span>
        </button>
      </form>
    </div>
  );
}
