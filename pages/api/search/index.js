// GET /api/search — Unified search across entities
// POST /api/search — Advanced search with filters
import { withAuth } from "../../../lib/withAuth.js";
import { search, globalSearch } from "../../../lib/search/searchEngine.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { query, entity, page, limit, sort, ...filters } = req.query;
        if (!query) return res.status(400).json({ success: false, error: "Query parameter required" });

        const result = await search({
          query,
          entity: entity || "projects",
          filters,
          sort: sort ? JSON.parse(sort) : undefined,
          page: Number(page) || 1,
          limit: Number(limit) || 20,
        });

        return res.status(200).json(result);
      }

      case "POST": {
        const { query, entities, perEntityLimit } = req.body;
        if (!query) return res.status(400).json({ success: false, error: "Query required" });

        const result = await globalSearch(query, { entities, perEntityLimit });
        return res.status(200).json(result);
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
