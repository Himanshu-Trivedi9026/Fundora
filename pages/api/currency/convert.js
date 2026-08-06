// GET /api/currency/convert — Convert between currencies
import { convertAmount, formatCurrency } from "../../../lib/currency/currencyEngine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { amount, from, to, format } = req.query;

    if (!amount || !from || !to) {
      return res.status(400).json({ success: false, error: "amount, from, to required" });
    }

    const result = await convertAmount(Number(amount), from.toUpperCase(), to.toUpperCase());

    if (result.success && format) {
      const formatted = formatCurrency(result.data.convertedAmount, to.toUpperCase());
      return res.status(200).json({ ...result, data: { ...result.data, formatted } });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
