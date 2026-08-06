// components/ProjectChat.jsx
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";

const EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🎉", "😎", "🤝", "💡", "🚀"];

/** crypto.randomUUID needs a secure context; fall back for http-only dev. */
function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/**
 * Extract the object path ("chat_attachments/<projectId>/<file>") from a public
 * Supabase storage URL so we can delete the object when a message is removed.
 */
function deriveStoragePath(url) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

/**
 * Feature-detect whether the migration has been applied. Without it,
 * `project_messages` has no read_by / delivered_at columns, so any SELECT or
 * UPDATE touching them would 400. We probe once and cache the result.
 * Returns null while the probe is in flight.
 */
let schemaSupportCache = null; // null = unknown, true/false = known
async function detectSchemaSupport() {
  if (schemaSupportCache !== null) return schemaSupportCache;
  const { error } = await supabase
    .from("project_messages")
    .select("read_by")
    .limit(0);
  schemaSupportCache = !error;
  return schemaSupportCache;
}

export default function ProjectChat({ projectId, onFirstRender }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);

  // ROLE DATA
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [teamMemberIds, setTeamMemberIds] = useState([]);

  // UI STATES
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Realtime presence: who is actually in this chat right now (not a random number)
  const [activeUsers, setActiveUsers] = useState(0);
  // Whether the schema supports persistent read receipts
  const [schemaReady, setSchemaReady] = useState(false);

  // Scroll state
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const nearBottomRef = useRef(true);
  const isFirstLoadRef = useRef(true);

  // Read receipts state
  const [readByMap, setReadByMap] = useState({}); // messageId -> Set of user ids
  const [deliveredMap, setDeliveredMap] = useState({}); // messageId -> delivered bool
  // Mirror of readByMap for use inside markAsRead without making the callback
  // depend on a frequently-changing object (keeps the memoization stable).
  const readByMapRef = useRef(readByMap);
  useEffect(() => {
    readByMapRef.current = readByMap;
  }, [readByMap]);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------------- SCHEMA SUPPORT ---------------- */
  useEffect(() => {
    let cancelled = false;
    detectSchemaSupport().then((ok) => {
      if (!cancelled) setSchemaReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- LOAD ROLES ---------------- */
  useEffect(() => {
    if (!projectId) return;

    async function loadRoles() {
      const { data: project } = await supabase
        .from("projects")
        .select("owner_id")
        .eq("id", projectId)
        .single();

      setProjectOwnerId(project?.owner_id || null);

      const { data: team } = await supabase
        .from("team_members")
        .select("creator_id")
        .eq("project_id", projectId);

      setTeamMemberIds(team?.map((m) => m.creator_id) || []);
    }

    loadRoles();
  }, [projectId]);

  /* ---------------- AUTO SCROLL (near-bottom only) ---------------- */
  const scrollToBottom = useCallback((behavior = "smooth") => {
    const el = bottomRef.current;
    // scrollIntoView is not implemented in jsdom / some older browsers; the
    // no-op fallback keeps the chat usable there (scroll position still works
    // via the user's own scroll).
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior });
    }
  }, []);

  // Track whether the user is near the bottom of the message list.
  // When they scroll up to read history, we STOP forcing the view down.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 120; // px from the bottom
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    nearBottomRef.current = near;
  }, []);

  // Initial load: jump straight to the bottom (no animation).
  useEffect(() => {
    if (messages.length > 0 && isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      scrollToBottom("auto");
    }
  }, [messages, scrollToBottom]);

  // After the very first paint of a NEW message from myself, scroll if near bottom.
  useEffect(() => {
    if (isFirstLoadRef.current) return;
    if (nearBottomRef.current) scrollToBottom("smooth");
  }, [messages.length, scrollToBottom]);

  /* ---------------- LOAD MESSAGES + READ STATE ---------------- */
  useEffect(() => {
    if (!projectId) return;

    let channel = null;

    async function loadMessages() {
      const { data } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      setMessages(data || []);

      // Notify the floating widget of the already-existing message ids so they
      // are never counted as unread after the chat has been opened.
      if (onFirstRender && data?.length) {
        onFirstRender(data.map((m) => m.id));
      }

      // Hydrate read/delivered state from the rows when the schema supports it.
      if (data) {
        const readMap = {};
        const delivMap = {};
        for (const m of data) {
          readMap[m.id] = Array.isArray(m.read_by) ? new Set(m.read_by) : new Set();
          delivMap[m.id] = !!m.delivered_at;
        }
        setReadByMap(readMap);
        setDeliveredMap(delivMap);
      }
    }

    loadMessages();

    /* ---------------- REALTIME: new messages ---------------- */
    channel = supabase
      .channel(`project-chat-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => {
            // Deduplicate against optimistic rows using the same attachment URL / id
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          setReadByMap((prev) => ({
            ...prev,
            [m.id]: Array.isArray(m.read_by) ? new Set(m.read_by) : new Set(),
          }));
          setDeliveredMap((prev) => ({
            ...prev,
            [m.id]: !!m.delivered_at,
          }));
          // When someone else sends a message while I'm near the bottom, scroll.
          if (m.sender_id !== user?.id) {
            requestAnimationFrame(() => {
              if (nearBottomRef.current) scrollToBottom("smooth");
            });
          }
        }
      )
      .subscribe();

    /* ---------------- REALTIME PRESENCE (who's actually in the chat) ---------------- */
    const presenceChannel = supabase.channel(`presence-project-${projectId}`);
    const presenceSet = new Set();

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        presenceSet.clear();
        Object.values(state).forEach((u) =>
          u.forEach((p) => p.user_id && presenceSet.add(p.user_id))
        );
        setActiveUsers(presenceSet.size);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        newPresences.forEach((p) => p.user_id && presenceSet.add(p.user_id));
        setActiveUsers(presenceSet.size);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        leftPresences.forEach((p) => p.user_id && presenceSet.delete(p.user_id));
        setActiveUsers(presenceSet.size);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user?.id) {
          await presenceChannel.track({ user_id: user.id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [projectId, user?.id, scrollToBottom, onFirstRender]);

  /* ---------------- MARK MY MESSAGE AS READ ---------------- */
  // When the chat is open and I'm reading, mark messages from others as read.
  // Persisted to the DB when the schema supports it; otherwise stored locally.
  const markAsRead = useCallback(
    // The useCallback is semantically correct (keeps the observer from
    // resubscribing every render); the compiler just can't prove the closure
    // is stable, so it bails out of memoizing the component.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    async (messageIds) => {
      if (!user?.id || messageIds.length === 0) return;

      const map = readByMapRef.current;
      const idsToMark = messageIds.filter(
        (id) => !(map[id] && map[id].has(user.id))
      );
      if (idsToMark.length === 0) return;

      // Local (immediate) — for my own view + graceful fallback.
      setReadByMap((prev) => {
        const next = { ...prev };
        for (const id of idsToMark) {
          next[id] = new Set([...(prev[id] || []), user.id]);
        }
        return next;
      });

      if (schemaReady) {
        // Persistent: append my id to read_by on each message.
        await Promise.all(
          idsToMark.map(async (id) => {
            const current = map[id] || new Set();
            const next = [...current, user.id];
            await supabase
              .from("project_messages")
              .update({ read_by: next })
              .eq("id", id);
          })
        );
      }
    },
    [user?.id, schemaReady]
  );

  // Observer to detect when messages scroll into view → they are "read".
  // Guarded for environments without IntersectionObserver (SSR, older browsers,
  // tests). In those cases read-marking simply doesn't run — delivery status
  // and optimistic sending still work.
  useEffect(() => {
    if (!user?.id || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target.getAttribute("data-msg-id"))
          .filter(Boolean);
        if (seen.length > 0) markAsRead(seen);
      },
      { root: scrollRef.current, threshold: 0.6 }
    );

    // Observe message rows (add data-msg-id to each message wrapper).
    const nodes = scrollRef.current?.querySelectorAll("[data-msg-id]") || [];
    nodes.forEach((n) => observer.observe(n));

    return () => observer.disconnect();
  }, [messages, user?.id, markAsRead]);

  /* ---------------- SEND MESSAGE ---------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !user) return;

    const optimisticId = makeId();

    // Optimistic row so the message appears instantly (delivery status: sending).
    const optimisticMsg = {
      id: optimisticId,
      project_id: projectId,
      sender_id: user.id,
      sender_name: user.email || "User",
      content: text.trim(),
      attachment_url: null,
      attachment_type: null,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data, error } = await supabase
      .from("project_messages")
      .insert({
        project_id: projectId,
        sender_id: user.id,
        sender_name: user.email || "User",
        content: text.trim(),
        attachment_url: null,
        attachment_type: null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Send message error:", error);
      // Replace optimistic row with a failed state (show retry / error icon).
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, _failed: true } : m
        )
      );
      return;
    }

    // Swap optimistic id → real id, mark delivered.
    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? { ...m, id: data.id, _optimistic: false } : m))
    );
    setDeliveredMap((prev) => ({ ...prev, [data.id]: true }));

    setText("");
    setShowEmojis(false);
  }

  /* ---------------- FILE UPLOAD ---------------- */
  async function uploadFile(file) {
    if (!file || !user) return;

    if (file.size > MAX_FILE_BYTES) {
      alert(`File must be ${MAX_FILE_MB}MB or smaller`);
      return;
    }

    setUploading(true);

    const ext = file.name.split(".").pop() || "bin";
    const path = `${projectId}/${Date.now()}-${user.id}.${ext}`;

    let uploadError;
    try {
      const res = await supabase.storage
        .from("chat_attachments")
        .upload(path, file);
      uploadError = res.error;
    } catch (err) {
      uploadError = err;
    }

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert(uploadError?.message === "row-level security policy"
        ? "Upload not permitted — chat attachments policy may be missing."
        : "Upload failed");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("chat_attachments")
      .getPublicUrl(path);

    const type = file.type.startsWith("image")
      ? "image"
      : file.type.startsWith("video")
      ? "video"
      : "file";

    const optimisticId = makeId();
    const optimisticMsg = {
      id: optimisticId,
      project_id: projectId,
      sender_id: user.id,
      sender_name: user.email || "User",
      content: null,
      attachment_url: data.publicUrl,
      attachment_type: type,
      attachment_name: file.name,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { data: inserted, error: insertError } = await supabase
      .from("project_messages")
      .insert({
        project_id: projectId,
        sender_id: user.id,
        sender_name: user.email || "User",
        content: null,
        attachment_url: data.publicUrl,
        attachment_type: type,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Attachment insert error:", insertError);
      // Try to remove the orphaned object so we don't leak storage.
      try {
        await supabase.storage.from("chat_attachments").remove([deriveStoragePath(data.publicUrl)]);
      } catch {}
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, _failed: true } : m))
      );
      setUploading(false);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? { ...m, id: inserted.id, _optimistic: false } : m))
    );
    setDeliveredMap((prev) => ({ ...prev, [inserted.id]: true }));
    setUploading(false);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  /* ---------------- DELETE ATTACHMENT MESSAGE ---------------- */
  async function deleteMessage(msg) {
    if (!confirm("Delete this message?")) return;
    // Remove storage object for attachments to avoid orphans.
    if (msg.attachment_url) {
      const objPath = deriveStoragePath(msg.attachment_url);
      if (objPath) {
        await supabase.storage.from("chat_attachments").remove([objPath]);
      }
    }
    await supabase.from("project_messages").delete().eq("id", msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  }

  /* ---------------- ROLE HELPERS ---------------- */
  function getUserRole(userId) {
    if (userId === projectOwnerId) return "Owner";
    if (teamMemberIds.includes(userId)) return "Team";
    return "Member";
  }

  function roleBadgeStyle(role) {
    if (role === "Owner") return "bg-primary/20 text-primary";
    if (role === "Team") return "bg-blue-500/20 text-blue-400";
    return "bg-surface-variant text-on-surface-variant";
  }

  /* ---------------- READ / DELIVERY STATUS HELPERS ---------------- */
  // Note: "Sending…" / "Failed" states are handled inline in the bubble via
  // _optimistic / _failed flags. This returns the persisted-state label.
  function deliveryLabel() {
    return "Sent";
  }

  function seenCount(msg) {
    // Count of users (excluding sender) who have read this message.
    const set = readByMap[msg.id];
    if (!set) return 0;
    let count = 0;
    set.forEach((uid) => {
      if (uid !== msg.sender_id) count++;
    });
    return count;
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─── HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-5 border-b border-outline-variant/30 flex justify-between items-center bg-surface-container-highest/20"
      >
        <div>
          <h3 className="font-geist text-white text-[18px] font-semibold">
            Project Chat
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <p className="text-[12px] text-on-surface-variant font-inter">
              {activeUsers > 0
                ? `${activeUsers} ${activeUsers === 1 ? "person" : "people"} in chat`
                : "Connecting…"}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="material-symbols-outlined text-on-surface-variant hover:text-white transition-colors"
          aria-label="Chat options"
        >
          more_vert
        </motion.button>
      </motion.div>

      {/* ─── MESSAGES ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar"
      >
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 block mb-3">
              forum
            </span>
            <p className="text-on-surface-variant font-inter text-sm">
              Start the conversation
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => {
            const role = getUserRole(msg.sender_id);
            const isMe = user?.id === msg.sender_id;
            const isFailed = !!msg._failed;
            const isOptimistic = !!msg._optimistic;
            const seen = seenCount(msg);

            return (
              <motion.div
                key={msg.id}
                data-msg-id={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${
                  isFailed ? "opacity-60" : ""
                }`}
              >
                {/* Sender Info */}
                <div className={`flex items-center gap-2 mb-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-tight ${roleBadgeStyle(role)}`}>
                    {role.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-mono truncate max-w-[140px]">
                    {msg.sender_name?.split("@")[0] || "User"}
                  </span>
                </div>

                {/* Bubble */}
                <div
                  className={`px-4 py-2.5 text-sm max-w-[85%] break-words ${
                    isMe
                      ? "bg-primary-container/80 text-on-primary-container rounded-2xl rounded-tr-none"
                      : "bg-surface-container-high text-on-surface rounded-2xl rounded-tl-none border border-outline-variant/20"
                  }`}
                >
                  {msg.content && (
                    <p className="font-inter leading-relaxed">{msg.content}</p>
                  )}

                  {/* IMAGE ATTACHMENT PREVIEW */}
                  {msg.attachment_url && msg.attachment_type === "image" && (
                    <div className="relative mt-2 w-full h-48 max-h-48">
                      <Image
                        src={msg.attachment_url}
                        alt="Chat attachment"
                        fill
                        sizes="(max-width: 768px) 100vw, 480px"
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}

                  {/* VIDEO ATTACHMENT PREVIEW */}
                  {msg.attachment_url && msg.attachment_type === "video" && (
                    <video
                      src={msg.attachment_url}
                      controls
                      className="mt-2 w-full rounded-lg max-h-48 object-contain border border-outline-variant/20"
                    />
                  )}

                  {/* FILE / DOCUMENT ATTACHMENT */}
                  {msg.attachment_url && msg.attachment_type === "file" && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={msg.attachment_name}
                      className="text-primary underline mt-2 block text-sm flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                      {msg.attachment_name || "Download file"}
                    </a>
                  )}

                  {/* Delivery / read status for MY messages */}
                  {isMe && (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-on-surface-variant/70">
                      {isFailed ? (
                        <span className="text-danger flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">error</span>
                          Failed to send
                        </span>
                      ) : isOptimistic ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] animate-pulse">schedule</span>
                          Sending…
                        </span>
                      ) : (
                        <>
                          <span>{deliveryLabel()}</span>
                          {seen > 0 && (
                            <span className="flex items-center gap-0.5 text-primary">
                              <span className="material-symbols-outlined text-[12px]">done_all</span>
                              Seen by {seen}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Delete for messages I sent */}
                  {isMe && !isOptimistic && (
                    <button
                      onClick={() => deleteMessage(msg)}
                      className="mt-1 text-[10px] text-on-surface-variant/50 hover:text-danger transition-colors flex items-center gap-0.5"
                      aria-label="Delete message"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete</span>
                      Delete
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ─── EMOJI PICKER ─── */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-outline-variant/30 overflow-hidden"
          >
            <div className="p-3 flex flex-wrap gap-1.5">
              {EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setText((t) => t + emoji)}
                  className="text-xl p-1 hover:bg-surface-variant/50 rounded-lg transition-colors"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── INPUT AREA ─── */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="p-4 bg-surface-container-low/50 border-t border-outline-variant/30"
        >
          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 bg-surface-container-highest/50 p-2 rounded-xl border border-outline-variant/30 focus-within:border-primary transition-colors"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowEmojis((s) => !s)}
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1"
              aria-label="Toggle emoji picker"
            >
              mood
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1 disabled:opacity-50"
              aria-label="Attach file"
            >
              {uploading ? "hourglass_top" : "attach_file"}
            </motion.button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx"
            />

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-on-surface text-sm font-inter placeholder:text-on-surface-variant/50 outline-none"
              placeholder="Type a message..."
            />

            <motion.button
              type="submit"
              disabled={uploading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-lg font-bold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {uploading ? "..." : "Send"}
            </motion.button>
          </form>
        </motion.div>
      )}
    </div>
  );
}

