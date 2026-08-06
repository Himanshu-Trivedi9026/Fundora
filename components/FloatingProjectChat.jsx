// components/FloatingProjectChat.jsx
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import ProjectChat from "./ProjectChat";

/* Simple client-side mount detection — no setState in effect */
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function FloatingProjectChat({ projectId }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Ref to track message ids we have already counted toward the unread badge,
  // so a message is never double-counted even if it arrives via multiple paths
  // (initial load, realtime, optimistic insert on our own device).
  const countedRef = useRef(new Set());

  /* REALTIME UNREAD (primary) */
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`unread-project-chat-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const id = payload.new?.id;
          if (!id || countedRef.current.has(id)) return;
          // Ignore messages I sent myself (another tab / device of mine).
          const me = payload.new?.sender_id;
          // If the chat is closed, count as unread.
          if (!open) {
            countedRef.current.add(id);
            setUnread((u) => u + 1);
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [projectId, open]);

  /* Reset the badge when the chat is opened. */
  function toggleChat() {
    if (!open) {
      setUnread(0);
      countedRef.current = new Set();
    }
    setOpen((v) => !v);
  }

  if (!mounted || !projectId) return null;

  return createPortal(
    <>
      {/* ═══════════ CHAT WINDOW ═══════════ */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Project chat"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: "fixed",
              bottom: "96px",
              right: "24px",
              width: "380px",
              height: "540px",
              zIndex: 99999,
            }}
            className="glass-card rounded-xl shadow-2xl overflow-hidden flex flex-col border-primary/10"
          >
            <ProjectChat
              projectId={projectId}
              onFirstRender={(messageIds) => {
                // If the chat just opened and there were pre-existing messages,
                // none of them are "unread" anymore — they were already loaded.
                messageIds?.forEach((id) => countedRef.current.add(id));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ FLOATING BUTTON ═══════════ */}
      <motion.button
        onClick={toggleChat}
        aria-label={open ? "Close project chat" : "Open project chat"}
        aria-expanded={open}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
        }}
        className="w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center border-4 border-surface group"
      >
        <motion.span
          animate={open ? { rotate: 0 } : { rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: open ? 0 : 1 }}
          className="material-symbols-outlined text-[28px]"
        >
          {open ? "close" : "chat"}
        </motion.span>

        {/* Unread Badge */}
        <AnimatePresence>
          {unread > 0 && !open && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-danger text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>,
    document.body,
  );
}
