import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(customMessage) {
    const userMessage = customMessage || input;
    if (!userMessage.trim()) return;

    const updatedMessages = [
      ...messages,
      { role: "user", content: userMessage },
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage,
          history: updatedMessages,
        }),
      });

      const data = await res.json();

      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", content: "⚠️ AI error" }]);
    }

    setLoading(false);
  }

  return (
    <>
      {/* FLOAT BUTTON */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close AI chat" : "Open AI chat"}
          aria-expanded={open}
          className="bg-gradient-to-r from-purple-600 to-pink-500 hover:scale-110 transition-all text-white px-4 py-3 rounded-full shadow-xl animate-pulse"
        >
          💡
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Fundora AI Chat"
          className="fixed bottom-20 right-6 w-80 h-[520px] bg-slate-900/80 backdrop-blur-xl text-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-700 overflow-hidden"
        >
          {/* HEADER */}
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-600/20 to-pink-500/20">
            <h2 className="font-semibold">🤖 Fundora AI</h2>
            <span className="text-xs text-green-400">● Online</span>
          </div>

          {/* CHAT */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.length === 0 && (
              <p className="text-slate-400 text-center">
                Ask about funding, projects, or growth 🚀
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 ml-auto"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {msg.content}
              </div>
            ))}

            {loading && (
              <div className="text-xs text-slate-400 animate-pulse">
                AI is typing...
              </div>
            )}
          </div>

          {/* QUICK ACTIONS */}
          <div className="flex gap-2 p-3 border-t border-slate-700">
            <button
              onClick={() => sendMessage("Recommend best projects to support")}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 py-2 rounded-lg text-xs hover:scale-105 transition"
            >
              🔥 Recommend
            </button>

            <button
              onClick={() => sendMessage("Show trending projects")}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 py-2 rounded-lg text-xs hover:scale-105 transition"
            >
              📈 Trending
            </button>
          </div>

          {/* INPUT */}
          <div className="p-3 border-t border-slate-700 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Fundora AI..."
              aria-label="Ask Fundora AI"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => sendMessage()}
              className="bg-gradient-to-r from-purple-600 to-pink-500 px-3 rounded-lg text-white text-sm hover:scale-105 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
