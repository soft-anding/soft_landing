import { useEffect, useRef, useState } from "react";
import { api } from "../api";

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

  // Reset and greet when the category changes or chat first opens.
  useEffect(() => {
    if (!open) return;
    const greeting = category
      ? `היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים בקטגוריה "${category}". במה אוכל לעזור?`
      : "היי! אני כאן כדי לעזור לך עם הטפסים והמסמכים. במה אוכל לעזור?";
    setMessages([{ role: "assistant", text: greeting }]);
    setInput("");
    setFile(null);
  }, [open, category]);

  if (!open) return null;

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
        {messages.length > 0 && (
          messages.map((m, i) => {
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
          })
        )}
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
    </div>
  );
}
