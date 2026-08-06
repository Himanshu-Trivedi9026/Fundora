// GET /api/currency/rates — Get exchange rates
// POST /api/currency/rates — Update exchange rate
import { withAuth } from "../../../lib/withAuth.js";
import {
  getCurrencies,
  getExchangeRate,
  getHistoricalRates,
  updateExchangeRate,
  convertAmount,
} from "../../../lib/currency/currencyEngine.js";

async function handler(req, res) {
  try {
    switch (req.method) {
      case "GET": {
        const { from, to, amount, historical, date } = req.query;

        if (from && to && amount) {
          const result = await convertAmount(Number(amount), from, to);
          return res.status(200).json(result);
        }

        if (from && to && historical) {
          const result = await getHistoricalRates(from, to, date);
          return res.status(200).json(result);
        }

        if (from && to) {
          const result = await getExchangeRate(from, to);
          return res.status(200).json(result);
        }

        const result = await getCurrencies();
        return res.status(200).json(result);
      }

      case "POST": {
        const { fromCurrency, toCurrency, rate } = req.body;
        if (!fromCurrency || !toCurrency || rate === undefined) {
          return res.status(400).json({
            success: false,
            error: "fromCurrency, toCurrency, rate required",
          });
        }

        const result = await updateExchangeRate(fromCurrency, toCurrency, rate);
        return res.status(result.success ? 200 : 400).json(result);
      }

      default:
        return res
          .status(405)
          .json({ success: false, error: "Method not allowed" });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
