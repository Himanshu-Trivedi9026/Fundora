// pages/dm/[userId].js
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";
import { FiSmile, FiPaperclip } from "react-icons/fi";

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

  const typingTimeout = useRef(null);
  const bottomRef = useRef(null);
  const cleanupMessages = useRef(null);
  const cleanupTyping = useRef(null);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push("/login");
      else setCurrentUserId(data.user.id);
    });
  }, []);

  /* ---------------- INIT CONVERSATION ---------------- */
  useEffect(() => {
    if (currentUserId && otherUserId) initConversation();

    return () => {
      // Clean up subscriptions on unmount or dependency change
      cleanupMessages.current?.();
      cleanupTyping.current?.();
      clearTimeout(typingTimeout.current);
    };
  }, [currentUserId, otherUserId]);

  async function initConversation() {
    // Clean up previous subscriptions before creating new ones
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
    loadMessages(convo.id);
    cleanupMessages.current = subscribeMessages(convo.id);
    cleanupTyping.current = subscribeTyping(convo.id);
  }

  /* ---------------- LOAD MESSAGES ---------------- */
  async function loadMessages(id) {
    const { data } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  }

  /* ---------------- REALTIME: MESSAGES ---------------- */
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

  /* ---------------- REALTIME: TYPING ---------------- */
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

  /* ---------------- SEND TEXT MESSAGE (FIXED) ---------------- */
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

  /* ---------------- FILE UPLOAD (FIXED) ---------------- */
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
      console.error(uploadError);
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

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full p-6 flex flex-col">
        <div className="flex justify-end gap-4 text-xs mb-2">
          <button onClick={muteUser} className="text-yellow-400">
            Mute
          </button>
          <button onClick={blockUser} className="text-red-400">
            Block
          </button>
        </div>

        {typingUser && (
          <p className="text-xs text-slate-400 mb-2">Typing…</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[70%] px-4 py-2 rounded-lg text-sm ${
                m.sender_id === currentUserId
                  ? "ml-auto bg-cyan-600 text-white"
                  : "bg-slate-700 text-white"
              }`}
            >
              {m.attachment_url ? (
                m.attachment_type === "image" ? (
                  <img
                    src={m.attachment_url}
                    className="rounded-lg max-w-full"
                  />
                ) : (
                  <a
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    📎 Download attachment
                  </a>
                )
              ) : (
                m.content
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {showEmoji && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="text-xl"
                onClick={() => setText((t) => t + e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="mt-4 flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setShowEmoji((s) => !s)}
            className="text-white"
          >
            <FiSmile />
          </button>

          <label className="cursor-pointer text-white">
            <FiPaperclip />
            <input type="file" hidden onChange={uploadFile} />
          </label>

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
            placeholder="Message..."
            className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-white outline-none"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 rounded-lg text-white"
          >
            Send
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
