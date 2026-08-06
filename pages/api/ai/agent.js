import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

const rl = rateLimit({ windowMs: 60_000, max: 20 });

export default withAuth(async function handler(req, res, user) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!rl(req, res)) return;

    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🔥 Convert history
    const formattedHistory = history.map((msg) => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content,
    }));

    // 🔥 NEW: Fetch real project data
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("title, goal, pledged, created_at")
      .limit(5);

    const projectContext = (projects || []).map((p) => {
      const progress = p.goal ? (p.pledged / p.goal) * 100 : 0;

      // 🔥 TIME FACTOR (newer = better)
      const daysOld = Math.max(
        1,
        (Date.now() - new Date(p.created_at)) / (1000 * 60 * 60 * 24),
      );

      const freshnessScore = Math.max(0, 30 - daysOld); // max 30

      // 🔥 MOMENTUM (approx)
      const momentum = p.pledged / daysOld;

      // 🔥 FINAL SCORE
      const score =
        progress * 0.5 + // funding importance
        freshnessScore * 1 + // recency
        momentum * 0.05; // growth

      return {
        title: p.title,
        goal: p.goal,
        pledged: p.pledged,
        progress: `${progress.toFixed(1)}%`,
        score: score.toFixed(1),
      };
    });

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "Fundora AI",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3-8b-instruct",
          messages: [
            {
              role: "system",
              content: `You are Fundora AI.

You have access to real project data with scores:

${JSON.stringify(projectContext, null, 2)}

Your job:

If user is DONOR:
- Recommend top projects
- Explain using funding % and score

If user is CREATOR:
- Suggest improvements
- Detect weaknesses

FORMAT RULE (VERY IMPORTANT):
- ALWAYS respond in bullet points
- Each point should start with "•"
- Keep each point short (1 line)
- No long paragraphs

Example:
• Project A is 75% funded (high momentum)
• Project B has strong recent growth

Be concise and structured.`,
            },

            ...formattedHistory,

            {
              role: "user",
              content: message.trim(),
            },
          ],
        }),
      },
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({
        reply: "⚠️ AI response invalid",
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "⚠️ AI not responding. Try again.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AI agent error:", err);

    return res.status(500).json({
      error: "AI failed",
    });
  }
});
