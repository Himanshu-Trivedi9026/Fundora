// components/ProjectChat.jsx
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";

const EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🎉", "😎", "🤝", "💡", "🚀"];

export default function ProjectChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);

  // ROLE DATA
  const [projectOwnerId, setProjectOwnerId] = useState(null);
  const [teamMemberIds, setTeamMemberIds] = useState([]);

  // UI STATES
  const [showEmojis, setShowEmojis] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeCount] = useState(() => Math.floor(Math.random() * 20) + 3);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  /* ---------------- LOAD MESSAGES ---------------- */
  useEffect(() => {
    if (!projectId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

    const channel = supabase
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
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [projectId]);

  /* ---------------- SEND MESSAGE ---------------- */
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !user) return;

    await supabase.from("project_messages").insert({
      project_id: projectId,
      sender_id: user.id,
      sender_name: user.email,
      content: text.trim(),
      attachment_url: null,
      attachment_type: null,
    });

    setText("");
    setShowEmojis(false);
  }

  /* ---------------- FILE UPLOAD ---------------- */
  async function uploadFile(file) {
    if (!file || !user) return;

    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${projectId}/${Date.now()}-${user.id}.${ext}`;

    const { error } = await supabase.storage
      .from("chat_attachments")
      .upload(path, file);

    if (error) {
      alert("Upload failed");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("chat_attachments")
      .getPublicUrl(path);

    await supabase.from("project_messages").insert({
      project_id: projectId,
      sender_id: user.id,
      sender_name: user.email,
      content: null,
      attachment_url: data.publicUrl,
      attachment_type: file.type.startsWith("image")
        ? "image"
        : "file",
    });

    setUploading(false);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
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
              {activeCount} Developers active
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="material-symbols-outlined text-on-surface-variant hover:text-white transition-colors"
        >
          more_vert
        </motion.button>
      </motion.div>

      {/* ─── MESSAGES ─── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
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
          {messages.map((msg, i) => {
            const role = getUserRole(msg.sender_id);
            const isMe = user?.id === msg.sender_id;

            return (
              <motion.div
                key={msg.id}
                initial={{
                  opacity: 0,
                  x: isMe ? 20 : -20,
                  y: 10,
                }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: i * 0.02,
                }}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
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

                  {msg.attachment_url && msg.attachment_type === "image" && (
                    <img
                      src={msg.attachment_url}
                      alt="Chat attachment"
                      className="mt-2 rounded-lg max-h-48 object-cover"
                    />
                  )}

                  {msg.attachment_url && msg.attachment_type === "file" && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline mt-2 block text-sm flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-lg">attach_file</span>
                      Download file
                    </a>
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
              className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1"
              aria-label="Attach file"
            >
              attach_file
            </motion.button>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
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
              className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-lg font-bold text-sm hover:brightness-110 active:scale-95 transition-all"
            >
              {uploading ? "..." : "Send"}
            </motion.button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
