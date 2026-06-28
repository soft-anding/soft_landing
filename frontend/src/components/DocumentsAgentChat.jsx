import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function DocumentsAgentChat({ open, onClose, category, forms }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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

  // Reset and greet when the category changes or chat first opens.
  useEffect(() => {
    if (!open) return;
    const greeting = category
      ? `היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים בקטגוריה "${category}". במה אוכל לעזור?`
      : "היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים. במה אוכל לעזור?";
    setMessages([{ role: "assistant", text: greeting }]);
    setInput("");
  }, [open, category]);

  if (!open) return null;

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    try {
      const formNames = (forms || []).map((f) => f.name || "").filter(Boolean);
      await api.streamDocumentsAgentChat(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        category,
        formNames,
        (_chunk, full) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", text: full };
            return updated;
          });
        }
      );
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
        <button
          type="button"
          onClick={() => { setMessages([]); onClose(); }}
          className="absolute top-sm left-sm px-sm py-1 rounded-full border border-green-700 text-green-700 font-label-sm text-label-sm hover:bg-green-50 transition-colors"
        >
          סיים שיחה
        </button>
        <div className="pr-4 pl-lg">
          <h3 className="font-label-md text-label-md font-bold text-on-surface text-right">
            עוזר המסמכים
          </h3>
          <p className="font-label-sm text-label-sm text-on-surface-variant text-right">
            {category ? `קטגוריה: ${category}` : "שאלות על טפסים ומסמכים"}
          </p>
        </div>
      </div>

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
        <button
          type="submit"
          disabled={sending || !input.trim()}
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
