import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Floating launcher button that opens the chat — fixed in the same corner the
// chat panel itself opens from, so it reads as "tap here to open this panel."
export function TaskAgentFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="התייעצות עם סוכן AI"
      className="fixed bottom-6 left-6 z-[60] w-14 h-14 rounded-full bg-green-800 text-white flex items-center justify-center shadow-lg hover:bg-green-900 transition-colors"
    >
      <span className="material-symbols-outlined">smart_toy</span>
    </button>
  );
}

// Frontend shell for the upcoming task-AI agent. No backend wired yet —
// sending a message just appends it locally. Once the agent backend exists,
// replace handleSend's TODO with the real API call (including uploading `file`).
// Rendered as a small floating widget (not a full-height drawer) so it doesn't
// take over the screen like the task/info side panels do.
const GREETING =
  "היי! אני העוזר האישי שלך למעבר. אני כאן כדי לעזור לך לעשות סדר במשימות, להבין מה דחוף ומה אפשר לדחות, ולענות על כל שאלה לגבי התהליך. במה אפשר לעזור?";

export default function TaskAgentChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);

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

  // Greet the user automatically the first time the chat opens, before they type anything.
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", text: GREETING }]);
    }
  }, [open, messages.length]);

  if (!open) return null;

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
    try {
      const { reply } = await api.taskAgentChat(
        nextMessages.map((m) => ({ role: m.role, content: m.text }))
      );
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "מצטערים, הייתה שגיאה בפנייה לסוכן. נסו שוב." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleEndConversation() {
    // TODO: notify the backend the session ended, once it exists.
    setMessages([]);
    onClose();
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
          onClick={handleEndConversation}
          className="absolute top-sm left-sm px-sm py-1 rounded-full border border-green-700 text-green-700 font-label-sm text-label-sm hover:bg-green-50 transition-colors"
        >
          סיים שיחה
        </button>
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
        {messages.length > 0 && (
          messages.map((m, i) => (
            <div key={i} className="flex">
              <div
                dir="rtl"
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed text-black text-right break-words ${
                  m.role === "user"
                    ? "bg-white border border-gray-300 mr-auto"
                    : "bg-gray-100 ml-auto"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex">
            <div className="max-w-[80%] px-3 py-2 rounded-2xl text-xs text-black bg-gray-100 ml-auto">
              …
            </div>
          </div>
        )}
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
          className="flex-1 px-md py-1.5 rounded-xl border border-outline-variant font-body-md text-body-md text-right text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none overflow-y-auto leading-snug"
        />

        {/* Attach image/file */}
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
