import OpenAI from "openai";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const rl = rateLimit({ windowMs: 60_000, max: 5 });

export default withAuth(async function handler(req, res, user) {
  try {
    if (!rl(req, res)) return;
    const { title, category, goal } = req.body;

    if (!title || !category || !goal) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crowdfunding campaign writing expert. Generate compelling campaign description.",
        },
        {
          role: "user",
          content: `
Project Title: ${title}
Category: ${category}
Funding Goal: ₹${goal}

Write a persuasive crowdfunding campaign description.
`,
        },
      ],
    });

    const content =
      completion.choices?.[0]?.message?.content || "";

    // ⭐ VERY IMPORTANT: Always return 'content'
    return res.status(200).json({
      content,
    });

  } catch (error) {
    console.error("AI Campaign Error:", error);

    return res.status(500).json({
      error: "AI generation failed",
    });
  }
});
