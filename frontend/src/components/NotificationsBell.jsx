import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../supabaseClient";

const MAX_COLLAPSED = 4;

function BellIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className={className}>
      <rect width="256" height="256" fill="none" />
      <path d="M96,192a32,32,0,0,0,64,0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <path d="M56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
    </svg>
  );
}

function formatRelativeHe(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "לפני רגע";
  if (minutes < 60) {
    if (minutes === 1) return "לפני דקה";
    return `לפני ${minutes} דקות`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    if (hours === 1) return "לפני שעה";
    if (hours === 2) return "לפני שעתיים";
    return `לפני ${hours} שעות`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return "לפני יום";
  if (days === 2) return "לפני יומיים";
  return `לפני ${days} ימים`;
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("notifications")
      .select("id,content,task_title,item_type,item_id,severity,created_at,is_read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) setNotifications(data || []); });
    return () => { alive = false; };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function markAllRead() {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)
      .then(() => {})
      .catch(() => {});
  }

  function closeAndMarkRead() {
    setOpen(false);
    setExpanded(false);
    markAllRead();
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) closeAndMarkRead();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unreadCount]);

  const visible = expanded ? notifications : notifications.slice(0, MAX_COLLAPSED);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="התראות"
        onClick={() => (open ? closeAndMarkRead() : setOpen(true))}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
      >
        <BellIcon className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[10px] leading-[18px] text-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-sm w-80 bg-white rounded-2xl soft-shadow border border-outline-variant/30 overflow-hidden text-right">
          <div className="relative px-sm py-xs border-b border-outline-variant/30">
            <button
              type="button"
              onClick={closeAndMarkRead}
              aria-label="סגור"
              className="absolute top-xs right-xs w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-outline-variant/20 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>close</span>
            </button>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="absolute top-xs left-sm font-label-sm text-label-sm text-primary underline hover:no-underline disabled:text-on-surface-variant/40 disabled:no-underline disabled:cursor-default"
              style={{ lineHeight: "1.5rem" }}
            >
              סמן הכל כנקרא
            </button>
            <h3 className="font-label-md text-label-md font-bold text-on-surface pr-6" style={{ lineHeight: "1.5rem" }}>התראות</h3>
          </div>

          {notifications.length === 0 ? (
            <p className="px-sm py-md text-center font-label-sm text-label-sm text-on-surface-variant">
              אין התראות חדשות
            </p>
          ) : (
            <>
              <div className={expanded ? "max-h-72 overflow-y-auto" : ""}>
                {visible.map((n) => {
                  const urgent = n.severity === "urgent";
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-xs px-sm py-xs border-b border-outline-variant/20 last:border-b-0 ${
                        urgent ? "bg-error-container/40" : ""
                      }`}
                    >
                      {!n.is_read && (
                        <span
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${urgent ? "bg-error" : "bg-primary"}`}
                          aria-hidden="true"
                        />
                      )}
                      <div className={n.is_read ? "mr-[10px]" : ""}>
                        <p className={`font-bold font-label-md text-label-md ${urgent ? "text-error" : "text-on-surface"}`}>
                          {n.content}
                        </p>
                        {n.task_title && (
                          <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                            {n.task_title}
                          </p>
                        )}
                        <div className="flex items-center gap-sm mt-0.5">
                          {n.item_type && n.item_id != null && (
                            <button
                              type="button"
                              onClick={() => {
                                closeAndMarkRead();
                                navigate(`/item/${n.item_type}/${n.item_id}`);
                              }}
                              className="font-label-sm text-label-sm text-primary underline hover:no-underline"
                            >
                              לחץ לפרטים
                            </button>
                          )}
                          <p className="font-label-sm text-label-sm text-on-surface-variant">
                            {formatRelativeHe(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!expanded && notifications.length > MAX_COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="w-full px-sm py-xs font-label-sm text-label-sm text-primary hover:bg-outline-variant/10 transition-colors text-center"
                >
                  הצג הכל
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
