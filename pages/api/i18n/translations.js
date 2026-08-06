// GET /api/i18n/translations — Get translations
// POST /api/i18n/translations — Add/update translation
import { withAuth } from "../../../lib/withAuth.js";
import { loadTranslations, addTranslation, listLanguagePacks } from "../../../lib/i18n/translationService.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { locale, namespace, packs } = req.query;

        if (packs) {
          const result = await listLanguagePacks();
          return res.status(200).json(result);
        }

        if (!locale) return res.status(400).json({ success: false, error: "locale required" });
        const result = await loadTranslations(locale, namespace || "default");
        return res.status(200).json(result);
      }

      case "POST": {
        const { locale, namespace, key, value } = req.body;
        if (!locale || !key || value === undefined) {
          return res.status(400).json({ success: false, error: "locale, key, value required" });
        }

        const result = await addTranslation(locale, namespace || "default", key, value);
        return res.status(result.success ? 201 : 400).json(result);
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
