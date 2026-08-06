// GET /api/search/autocomplete — Autocomplete suggestions
import { getSuggestions, getTrendingSearches } from "../../../lib/search/autocompleteEngine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { query, trending, limit } = req.query;

    if (trending) {
      const result = await getTrendingSearches({ limit: Number(limit) || 10 });
      return res.status(200).json(result);
    }

    if (!query) return res.status(400).json({ success: false, error: "Query parameter required" });

    const result = await getSuggestions(query, { limit: Number(limit) || 10 });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
