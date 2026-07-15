// components/FloatingProjectChat.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import ProjectChat from "./ProjectChat";
import { FaComments, FaTimes } from "react-icons/fa";

export default function FloatingProjectChat({ projectId }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastSeenRef = useRef(Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  /* REALTIME UNREAD */
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
        () => {
          if (!open) setUnread((u) => u + 1);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [projectId, open]);

  function toggleChat() {
    if (!open) {
      setUnread(0);
      lastSeenRef.current = Date.now();
    }
    setOpen((v) => !v);
  }

  if (!mounted || !projectId) return null;

  return createPortal(
    <>
      {/* CHAT WINDOW */}
      {open && (
        <div
          role="dialog"
          aria-label="Project chat"
          style={{
            position: "fixed",
            bottom: "96px",
            right: "24px",
            width: "360px",
            height: "520px",
            zIndex: 99999,
          }}
          className="rounded-xl shadow-2xl overflow-hidden bg-slate-900"
        >
          <ProjectChat projectId={projectId} />
        </div>
      )}

      {/* FLOATING BUTTON */}
      <button
        onClick={toggleChat}
        aria-label={open ? "Close project chat" : "Open project chat"}
        aria-expanded={open}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99999,
        }}
        className="
          w-14 h-14
          rounded-full
          bg-cyan-600 hover:bg-cyan-500
          flex items-center justify-center
          text-white
          shadow-xl
          transition
          relative
        "
      >
        {open ? <FaTimes size={20} /> : <FaComments size={22} />}

        {unread > 0 && !open && (
          <span
            className="
              absolute -top-1 -right-1
              bg-red-600 text-white
              text-[10px]
              w-5 h-5
              rounded-full
              flex items-center justify-center
            "
          >
            {unread}
          </span>
        )}
      </button>
    </>,
    document.body
  );
}
