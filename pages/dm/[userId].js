// pages/dm/[userId].js
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";

export default function DMChat() {
  /* ---------------- EMOJIS ---------------- */
  const EMOJIS = ["😀", "😂", "😍", "😎", "👍", "🔥", "🎉", "🚀", "❤️"];

  const router = useRouter();
  const otherUserId = router.query.userId;

  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const typingTimeout = useRef(null);
  const bottomRef = useRef(null);
  const cleanupMessages = useRef(null);
  const cleanupTyping = useRef(null);

  /* ---------------- AUTH ---------------- */
  const loadInbox = useCallback(async (uid) => {
    const userIdToUse = uid || currentUserId;
    if (!userIdToUse) return;

    const { data } = await supabase
      .from("dm_conversations")
      .select(`
        id,
        user1,
        user2,
        created_at,
        dm_messages (
          content,
          created_at
        )
      `)
      .or(`user1.eq.${userIdToUse},user2.eq.${userIdToUse}`)
      .order("created_at", { ascending: false });

    setThreads(data || []);
  }, [currentUserId]);

  const initConversation = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      async function loadMessages(id) {
        const { data } = await supabase
          .from("dm_messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        setMessages(data || []);
      }

      function subscribeMessages(id) {
        const ch = supabase
          .channel(`dm-${id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "dm_messages",
              filter: `conversation_id=eq.${id}`,
            },
            (payload) => {
              setMessages((prev) => [...prev, payload.new]);
            }
          )
          .subscribe();

        return () => supabase.removeChannel(ch);
      }

      function subscribeTyping(id) {
        const ch = supabase
          .channel(`typing-${id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "typing_status",
              filter: `conversation_id=eq.${id}`,
            },
            (payload) => {
              if (payload.new.user_id !== currentUserId) {
                setTypingUser(payload.new.is_typing);
              }
            }
          )
          .subscribe();

        return () => supabase.removeChannel(ch);
      }

      cleanupMessages.current?.();
      cleanupTyping.current?.();
      const u1 = [currentUserId, otherUserId].sort()[0];
      const u2 = [currentUserId, otherUserId].sort()[1];

      let { data: convo } = await supabase
        .from("dm_conversations")
        .select("*")
        .eq("user1", u1)
        .eq("user2", u2)
        .maybeSingle();

      if (!convo) {
        const { data } = await supabase
          .from("dm_conversations")
          .insert({ user1: u1, user2: u2 })
          .select()
          .single();
        convo = data;
      }

      setConversationId(convo.id);
      await loadMessages(convo.id);
      cleanupMessages.current = subscribeMessages(convo.id);
      cleanupTyping.current = subscribeTyping(convo.id);
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      else {
        setCurrentUserId(data.user.id);
        loadInbox(data.user.id);
      }
    });
  }, [loadInbox, router]);

  /* ---------------- INIT CONVERSATION ---------------- */
  useEffect(() => {
    if (currentUserId && otherUserId) {
      initConversation();
    }

    return () => {
      cleanupMessages.current?.();
      cleanupTyping.current?.();
      clearTimeout(typingTimeout.current);
    };
  }, [currentUserId, otherUserId, initConversation]);

  
  async function sendTyping(status) {
    if (!conversationId) return;

    await supabase.from("typing_status").upsert({
      conversation_id: conversationId,
      user_id: currentUserId,
      is_typing: status,
    });
  }

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- SEND TEXT MESSAGE ---------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !conversationId) return;

    const { error } = await supabase.from("dm_messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text.trim(),
      attachment_url: null,
      attachment_type: null,
    });

    if (error) {
      console.error("Send message error:", error);
      return;
    }

    setText("");
    sendTyping(false);
  }

  /* ---------------- FILE UPLOAD ---------------- */
  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file || !conversationId) return;

    const ext = file.name.split(".").pop();
    const type = file.type.startsWith("image")
      ? "image"
      : file.type.startsWith("video")
      ? "video"
      : "file";

    const path = `${conversationId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file);

    if (uploadError) {
      console.error("File upload error:", uploadError);
      return;
    }

    const { data } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    await supabase.from("dm_messages").insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: "",
      attachment_url: data.publicUrl,
      attachment_type: type,
    });
  }

  /* ---------------- BLOCK / MUTE ---------------- */
  async function blockUser() {
    await supabase.from("blocked_users").insert({
      blocker_id: currentUserId,
      blocked_id: otherUserId,
    });
    router.push("/dm");
  }

  async function muteUser() {
    await supabase.from("muted_users").insert({
      user_id: currentUserId,
      muted_user_id: otherUserId,
    });
    alert("User muted");
  }

  /* ---------------- NAVIGATE TO THREAD ---------------- */
  function openThread(thread) {
    const otherUser =
      thread.user1 === currentUserId ? thread.user2 : thread.user1;
    router.push(`/dm/${otherUser}`);
  }

  function getLastMessage(thread) {
    const msgs = thread.dm_messages || [];
    if (msgs.length === 0) return "No messages yet";
    return msgs[0].content || "Attachment";
  }

  function getTimestamp(thread) {
    const msgs = thread.dm_messages || [];
    const date = msgs.length > 0 ? msgs[0].created_at : thread.created_at;
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <Navbar />
        <main className="pt-16 min-h-screen flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-on-surface-variant font-inter text-lg"
          >
            Loading conversation...
          </motion.div>
        </main>
      </div>
    );
  }

  /* ================= MAIN UI ================= */

  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />

      <main className="pt-16 min-h-screen flex-1 relative">
        <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] flex gap-6 px-4 md:px-6 py-4 md:py-6">

          {/* ═══════════ LEFT PANE: Conversation List (desktop) ═══════════ */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="hidden md:flex w-[380px] flex-col glass-card rounded-2xl overflow-hidden shrink-0"
          >
            {/* Header */}
            <div className="p-5 border-b border-outline-variant">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-geist text-lg font-semibold text-on-surface">
                  Messages
                </h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 rounded-lg bg-surface-variant/50 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">edit_square</span>
                </motion.button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg" aria-hidden="true">
                  search
                </span>
                <input
                  className="w-full bg-surface-container border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 focus:ring-1 focus:ring-primary focus:border-primary text-on-surface placeholder:text-on-surface-variant/50 font-inter text-sm outline-none transition-all"
                  placeholder="Search conversations..."
                  type="text"
                  aria-label="Search conversations"
                />
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-2">
              {threads.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 block mb-3" aria-hidden="true">
                    forum
                  </span>
                  <p className="text-on-surface-variant font-inter text-sm">
                    No conversations yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {threads.map((thread) => {
                    const otherUser =
                      thread.user1 === currentUserId ? thread.user2 : thread.user1;
                    const isActive = otherUser === otherUserId;

                    return (
                      <motion.div
                        key={thread.id}
                        whileHover={{ x: 3 }}
                        onClick={() => openThread(thread)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openThread(thread); } }}
                        role="button"
                        tabIndex={0}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isActive
                            ? "bg-primary-container/10 border-l-4 border-primary"
                            : "hover:bg-surface-variant/30 border-l-4 border-transparent"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center">
                            <span className="material-symbols-outlined text-on-surface-variant/50 text-xl" aria-hidden="true">
                              person
                            </span>
                          </div>
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface-container rounded-full" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className={`font-geist text-sm truncate ${isActive ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}>
                              {otherUser.slice(0, 8)}...
                            </span>
                            <span className="text-[11px] text-on-surface-variant/60 shrink-0 ml-2">
                              {getTimestamp(thread)}
                            </span>
                          </div>
                          <p className={`font-inter text-sm truncate ${isActive ? "text-on-surface" : "text-on-surface-variant/70"}`}>
                            {getLastMessage(thread)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>

          {/* ═══════════ RIGHT PANE: Active Chat ═══════════ */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 flex flex-col glass-card rounded-2xl overflow-hidden relative"
          >
            {/* ─── Chat Header ─── */}
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface/40 backdrop-blur-md"
            >
              <div className="flex items-center gap-4">
                {/* Mobile back button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { router.push("/dm"); }}
                  className="md:hidden material-symbols-outlined text-on-surface-variant p-1"
                  aria-label="Back to messages"
                >
                  arrow_back
                </motion.button>

                <div className="relative">
                  <div className="w-11 h-11 rounded-full overflow-hidden border border-primary/20 bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant/50 text-xl" aria-hidden="true">
                      person
                    </span>
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-surface-container rounded-full" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-geist text-[18px] leading-tight text-on-surface">
                    {otherUserId?.slice(0, 8)}...
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" aria-hidden="true" />
                    <span className="text-[12px] text-on-surface-variant font-inter">
                      Active now
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* AI/Human Toggle */}
                <div className="hidden sm:flex items-center bg-surface-container p-1 rounded-full border border-outline-variant mr-2">
                  <button className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary text-on-primary ai-glow transition-all flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">smart_toy</span>
                    AI Help
                  </button>
                  <button className="px-3 py-1.5 rounded-full text-[12px] font-medium text-on-surface-variant hover:text-on-surface transition-colors">
                    Human
                  </button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-lg transition-all"
                  aria-label="Start video call"
                >
                  videocam
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-lg transition-all"
                  aria-label="Start voice call"
                >
                  call
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={muteUser}
                  className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-lg transition-all"
                  aria-label="Mute user"
                >
                  info
                </motion.button>
              </div>
            </motion.header>

            {/* ─── Messages Canvas ─── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide chat-gradient">
              {/* Date Separator */}
              <div className="flex justify-center">
                <span className="text-[12px] text-on-surface-variant bg-surface-container px-3 py-1 rounded-full uppercase tracking-widest font-inter">
                  {new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {/* Messages */}
              <AnimatePresence>
                {messages.map((m, i) => {
                  const isMine = m.sender_id === currentUserId;

                  return (
                    <motion.div
                      key={m.id}
                      initial={{
                        opacity: 0,
                        x: isMine ? 20 : -20,
                        y: 10,
                        scale: 0.95,
                      }}
                      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      transition={{
                        duration: 0.3,
                        ease: [0.25, 0.46, 0.45, 0.94],
                        delay: i * 0.03,
                      }}
                      className={`flex items-end gap-3 max-w-[80%] ${
                        isMine ? "ml-auto flex-row-reverse" : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border ${
                        isMine ? "border-primary-container/50" : "border-outline-variant"
                      } bg-surface-container-high flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-on-surface-variant/40 text-sm" aria-hidden="true">
                          {isMine ? "person" : "person"}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div className="space-y-1">
                        <div className={`p-4 rounded-2xl shadow-lg ${
                          isMine
                            ? "message-bubble-out ai-glow"
                            : "message-bubble-in"
                        }`}>
                          {m.attachment_url ? (
                            m.attachment_type === "image" ? (
                              <div className="relative w-full h-64 max-h-64">
                                <Image
                                  src={m.attachment_url}
                                  alt="Chat attachment"
                                  fill
                                  sizes="(max-width: 768px) 100vw, 480px"
                                  className="rounded-lg object-cover"
                                />
                              </div>
                            ) : (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className={`underline text-sm flex items-center gap-1 ${
                                  isMine ? "text-white" : "text-primary"
                                }`}
                              >
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">attach_file</span>
                                Download attachment
                              </a>
                            )
                          ) : (
                            <p className={`text-sm font-inter leading-relaxed ${
                              isMine ? "text-white" : "text-on-surface"
                            }`}>
                              {m.content}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] text-on-surface-variant font-inter ${
                          isMine ? "mr-2" : "ml-2"
                        }`}>
                          {new Date(m.created_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing Indicator */}
              <AnimatePresence>
                {typingUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant">
                      <span className="material-symbols-outlined text-on-surface-variant/40 text-sm" aria-hidden="true">person</span>
                    </div>
                    <div className="message-bubble-in px-4 py-3 rounded-2xl">
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex gap-1"
                      >
                        <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full" />
                        <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full" />
                        <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full" />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* ─── AI Suggested Replies ─── */}
            <div className="px-6 pb-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-1" aria-hidden="true">magic_button</span>
                {["Draft vesting contract", "Check audit status", "Send Q4 roadmap"].map(
                  (suggestion) => (
                    <motion.button
                      key={suggestion}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setText(suggestion)}
                      className="whitespace-nowrap px-4 py-2 bg-surface-container-high hover:bg-primary-container/20 border border-outline-variant rounded-full font-inter text-sm text-on-surface-variant hover:text-primary transition-all"
                    >
                      {suggestion}
                    </motion.button>
                  )
                )}
              </div>
            </div>

            {/* ─── Emoji Picker ─── */}
            <AnimatePresence>
              {showEmoji && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  className="px-6 pb-2 overflow-hidden"
                >
                  <div className="flex gap-2 flex-wrap bg-surface-container rounded-xl p-3 border border-outline-variant">
                    {EMOJIS.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        className="text-xl p-1 hover:bg-surface-variant/50 rounded-lg transition-colors"
                        onClick={() => setText((t) => t + emoji)}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Input Area ─── */}
            <footer className="p-4 md:p-6 bg-surface/60 backdrop-blur-xl border-t border-outline-variant">
              <form
                onSubmit={sendMessage}
                className="flex items-center gap-3 bg-surface-container-low border border-outline-variant p-2 rounded-2xl"
              >
                <div className="flex items-center gap-0.5">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary transition-colors"
                    aria-label="Add attachment"
                  >
                    add_circle
                  </motion.button>
                  <label className="cursor-pointer" aria-label="Upload image">
                    <motion.span
                      whileHover={{ scale: 1.1 }}
                      className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary transition-colors inline-block"
                      aria-hidden="true"
                    >
                      image
                    </motion.span>
                    <input type="file" hidden onChange={uploadFile} />
                  </label>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowEmoji((s) => !s)}
                    className="material-symbols-outlined p-2 text-on-surface-variant hover:text-primary transition-colors"
                    aria-label="Toggle emoji picker"
                  >
                    mood
                  </motion.button>
                </div>

                <div className="flex-1 h-10 flex items-center">
                  <input
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      sendTyping(true);
                      clearTimeout(typingTimeout.current);
                      typingTimeout.current = setTimeout(
                        () => sendTyping(false),
                        1200
                      );
                    }}
                    placeholder="Type your message or use /ai for help..."
                    aria-label="Type a message"
                    className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant/50 font-inter text-sm outline-none"
                  />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20 transition-all"
                  aria-label="Send message"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    send
                  </span>
                </motion.button>
              </form>
            </footer>
          </motion.section>

        </div>
      </main>
    </div>
  );
}
