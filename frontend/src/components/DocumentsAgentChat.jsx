import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Renders plain text with clickable links. Handles:
//   markdown  [label](https://...)
//   bare URL  https://...
// Each \n becomes a <br /> so multi-line agent replies display correctly.
function renderText(text) {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+)/g;
  return text.split("\n").map((line, li, arr) => {
    const parts = [];
    let last = 0;
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const href = m[2] || m[3];
      const label = m[1] || m[3];
      parts.push(
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer"
           className="text-primary underline break-all">
          {label}
        </a>
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={li}>
        {parts.length ? parts : line}
        {li < arr.length - 1 && <br />}
      </span>
    );
  });
}

function unwrapReply(text) {
  if (!text || !text.trimStart().startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.reply === "string") return parsed.reply;
  } catch {}
  const prefix = '{"reply":"';
  if (text.startsWith(prefix)) {
    let inner = text.slice(prefix.length);
    if (inner.endsWith('"}'))      inner = inner.slice(0, -2);
    else if (inner.endsWith('"'))  inner = inner.slice(0, -1);
    return inner.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return text;
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentsAgentChat({ open, onClose, category, forms }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [view, setView] = useState("chat");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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

  // Show greeting only when the chat opens with no existing conversation.
  // Re-opening after X keeps the previous messages intact.
  useEffect(() => {
    if (!open) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      const greeting = category
        ? `היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים בקטגוריה "${category}". במה אוכל לעזור?`
        : "היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים. במה אוכל לעזור?";
      return [{ role: "assistant", text: greeting }];
    });
  }, [open, category]);

  if (!open) return null;

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
        await api.updateDocumentsAgentConversation(loadedConversationId, payload);
      } else {
        await api.saveDocumentsAgentConversation(payload);
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

  async function loadConversation(id) {
    try {
      const data = await api.getDocumentsAgentConversation(id);
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
    const sentFile = file;
    setFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    try {
      let imageBase64 = null;
      let imageMimeType = null;
      if (sentFile) {
        imageMimeType = sentFile.type || "image/jpeg";
        imageBase64 = await fileToBase64(sentFile);
      }
      const formNames = (forms || []).map((f) => f.name || "").filter(Boolean);
      await api.streamDocumentsAgentChat(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        category,
        formNames,
        imageBase64,
        imageMimeType,
        (_chunk, full) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", text: unwrapReply(full) };
            return updated;
          });
        }
      );
      // Stream finished — unwrap JSON reply format if model returned {"reply":"..."}.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role !== "assistant" || !last.text) return prev;
        const clean = unwrapReply(last.text);
        if (clean === last.text) return prev;
        return [...prev.slice(0, -1), { ...last, text: clean }];
      });
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

  function switchToHistory() {
    if (view === "history") return;
    setView("history");
    setHistoryLoading(true);
    api.getDocumentsAgentConversations()
      .then((data) => setHistory(data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
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
      <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30 shrink-0">
        <div className="flex items-center gap-xs min-w-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
          <div className="min-w-0">
            <h3 className="font-label-md text-label-md font-bold text-on-surface leading-tight truncate">
              עוזר המסמכים
            </h3>
            <p className="text-on-surface-variant truncate" style={{ fontSize: "10px" }}>
              {category ? `קטגוריה: ${category}` : "שאלות על טפסים ומסמכים"}
            </p>
          </div>
        </div>

        {saveError ? (
          <div className="flex items-center gap-xs shrink-0">
            <span className="text-red-600 text-[10px] max-w-[100px] truncate" title={saveError}>
              שגיאה: {saveError}
            </span>
            <button
              type="button"
              onClick={() => { setSaveError(null); setMessages([]); onClose(); }}
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
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            view === "history"
              ? "border-primary text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          שיחות קודמות
        </button>
      </div>

      {/* ── History view ── */}
      {view === "history" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-md py-sm space-y-xs">
            {historyLoading && <p className="text-xs text-on-surface-variant text-center py-md">טוען...</p>}
            {!historyLoading && history.length === 0 && (
              <p className="text-xs text-on-surface-variant text-center py-md">אין שיחות שמורות עדיין</p>
            )}
            {history.map((conv) => (
              <button
                key={conv.conversation_id}
                type="button"
                onClick={() => loadConversation(conv.conversation_id)}
                className="w-full flex items-center justify-between gap-xs px-sm py-xs rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors text-right"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-on-surface truncate">
                    {conv.conversation_name || "שיחה ללא שם"}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {new Date(conv.created_at).toLocaleDateString("he-IL")}
                    {" · "}
                    {conv.message_count} הודעות
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: "14px" }}>
                  chevron_left
                </span>
              </button>
            ))}
          </div>
          <div className="shrink-0 px-md py-sm border-t border-outline-variant/20">
            <button
              type="button"
              onClick={startNewConversation}
              className="w-full flex items-center justify-center gap-xs py-1.5 rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
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
                    {isTyping ? "…" : renderText(m.text)}
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
                aria-label="הסר תמונה"
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
              accept="image/*"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-8 h-8 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center hover:bg-surface-container transition-colors"
              aria-label="הוסף תמונה"
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
