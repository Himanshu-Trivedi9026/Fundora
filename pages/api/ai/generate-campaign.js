import OpenAI from "openai";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

const rl = rateLimit({ windowMs: 60_000, max: 5 });

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate API key exists
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not configured in environment variables");
    return res.status(500).json({
      error:
        "AI service is not configured. Please add OPENAI_API_KEY to your .env.local file.",
    });
  }

  try {
    if (!rl(req, res)) return;

    const { title, category, goal } = req.body;

    if (!title || !category || !goal) {
      return res.status(400).json({
        error:
          "Missing required fields: title, category, and goal are all required.",
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crowdfunding campaign writing expert. Generate compelling, professional campaign descriptions that inspire confidence and drive donations. Use clear structure with paragraphs. Do not use markdown formatting — write in plain text.",
        },
        {
          role: "user",
          content: `Write a professional crowdfunding campaign description for:

Project Title: ${title}
Category: ${category}
Funding Goal: ₹${Number(goal).toLocaleString("en-IN")}

Requirements:
- Start with a compelling hook
- Explain what the project does and why it matters
- Describe the impact of funding
- Include a clear call to action
- Keep it between 150-300 words
- Write in a confident, professional tone`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = completion.choices?.[0]?.message?.content || "";

    if (!content.trim()) {
      return res.status(500).json({
        error: "AI returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({ content });
  } catch (error) {
    console.error("AI Campaign Error:", error);

    // Provide specific error messages
    if (error?.status === 401) {
      return res.status(500).json({
        error: "Invalid OpenAI API key. Please check your OPENAI_API_KEY.",
      });
    }
    if (error?.status === 429) {
      return res.status(429).json({
        error: "OpenAI rate limit exceeded. Please try again in a minute.",
      });
    }
    if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
      return res.status(500).json({
        error: "Unable to connect to AI service. Please check your network.",
      });
    }

    return res.status(500).json({
      error: "AI generation failed. Please try again later.",
    });
  }
});
