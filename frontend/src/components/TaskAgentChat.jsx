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


export default function TaskAgentChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [view, setView] = useState("chat"); // "chat" | "history"
  const [history, setHistory] = useState([]);
  const [historyFetching, setHistoryFetching] = useState(false);
  const [loadedConversationId, setLoadedConversationId] = useState(null);

  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

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

  async function loadConversation(id) {
    try {
      const data = await api.getTaskAgentConversation(id);
      setMessages(data.messages.map((m) => ({ role: m.role, text: m.content })));
      setLoadedConversationId(id);
      setView("chat");
    } catch { /* ignore */ }
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
      // Stream finished — unwrap JSON reply format.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role !== "assistant" || !last.text) return prev;
        const clean = unwrapReply(last.text);
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
      onClose();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload = messages.map((m) => ({ role: m.role, content: m.text }));
    try {
      if (loadedConversationId) {
        await api.updateTaskAgentConversation(loadedConversationId, payload);
      } else {
        await api.saveTaskAgentConversation(payload);
      }
      setSaving(false);
      setMessages([]);
      setLoadedConversationId(null);
      onClose();
    } catch (err) {
      setSaveError(err.message || "שגיאה לא ידועה");
      setSaving(false);
    }
  }

  async function switchToHistory() {
    if (view === "history" || historyFetching) return;
    setHistoryFetching(true);
    try {
      const data = await api.getTaskAgentConversations();
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryFetching(false);
    }
    setView("history");
  }

  function startNewConversation() {
    setMessages([]);
    setLoadedConversationId(null);
    setView("chat");
  }

  return (
    <div
      ref={panelRef}
      dir="rtl"
      className="fixed bottom-6 left-6 z-[60] w-[340px] h-[480px] bg-white rounded-2xl soft-shadow border border-outline-variant/30 flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="relative flex items-center justify-between px-md py-sm border-b border-outline-variant/30 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
        <h3 className="font-label-md text-label-md font-bold text-on-surface leading-tight truncate pr-4">
          העוזר האישי שלך למעבר
        </h3>

        {saveError ? (
          <div className="flex items-center gap-xs shrink-0">
            <span className="text-red-600 text-[10px] max-w-[100px] truncate" title={saveError}>
              שגיאה: {saveError}
            </span>
            <button
              type="button"
              onClick={() => { setSaveError(null); setMessages([]); setPendingSuggestion(null); onClose(); }}
              className="text-[10px] text-red-600 underline shrink-0"
            >
              סגור
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEndConversation}
            disabled={saving || sending}
            className="shrink-0 text-xs leading-tight px-3 py-1 rounded-full border border-green-700 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? "שומר..." : loadedConversationId ? "עדכן וסיים" : "סיום ושמירה"}
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-outline-variant/20">
        <button
          type="button"
          onClick={() => setView("chat")}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            view === "chat"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          צ'אט
        </button>
        <button
          type="button"
          onClick={switchToHistory}
          disabled={historyFetching}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-all ${
            view === "history"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          } ${historyFetching ? "opacity-50" : ""}`}
        >
          {historyFetching ? "טוען…" : "שיחות קודמות"}
        </button>
      </div>

      {/* ── History view ── */}
      {view === "history" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-md py-sm space-y-xs">
            <p className="text-[10px] text-on-surface-variant font-medium mb-xs text-right">השיחות שלך</p>
            {history.length === 0 && (
              <p className="text-xs text-on-surface-variant text-center py-md">אין שיחות שמורות עדיין</p>
            )}
            {history.map((conv) => (
              <button
                key={conv.conversation_id}
                type="button"
                onClick={() => loadConversation(conv.conversation_id)}
                className="w-full flex items-center justify-between gap-xs px-sm py-1.5 rounded bg-white border border-green-800/30 text-right"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-green-900 truncate">
                    {conv.conversation_name || "שיחה ללא שם"}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {(() => { const d = new Date(conv.created_at); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; })()}
                    {" · "}
                    {conv.message_count} הודעות
                  </p>
                </div>
                <span className="material-symbols-outlined text-gray-300 shrink-0" style={{ fontSize: "12px" }}>
                  chevron_left
                </span>
              </button>
            ))}
          </div>
          <div className="shrink-0 px-md py-sm border-t border-outline-variant/20">
            <button
              type="button"
              onClick={startNewConversation}
              className="w-full flex items-center justify-center py-2 rounded-xl bg-green-800 text-white text-xs font-medium hover:bg-green-900 transition-colors"
            >
              שיחה חדשה
            </button>
          </div>
        </div>
      )}

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-md py-md space-y-xs">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isTyping = sending && isLast && m.role === "assistant" && !m.text;

              return (
                <div key={i} className="flex">
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
        </>
      )}
    </div>
  );
}
