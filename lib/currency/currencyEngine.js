// Currency Engine — multi-currency support for Fundora
// Handles exchange rates, conversion, display/settlement currency, and provider abstraction

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";

const EXCHANGE_RATE_CACHE_TTL = 300000; // 5 minutes
let _rateCache = new Map();
let _lastRateRefresh = 0;
let _rateProvider = "manual";

export async function getCurrencies(activeOnly = true) {
  try {
    let query = supabaseAdmin.from("currencies").select("*");
    if (activeOnly) query = query.eq("is_active", true);
    query = query.order("code", { ascending: true });

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getCurrency(code) {
  try {
    const { data, error } = await supabaseAdmin
      .from("currencies")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (error) return { success: false, error: "Currency not found" };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return { success: true, data: { rate: 1, provider: "internal" } };
  }

  const cacheKey = `${fromCurrency}:${toCurrency}`;
  const now = Date.now();

  if (_rateCache.has(cacheKey) && (now - _lastRateRefresh) < EXCHANGE_RATE_CACHE_TTL) {
    return { success: true, data: _rateCache.get(cacheKey) };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("exchange_rates")
      .select("rate, provider")
      .eq("from_currency", fromCurrency.toUpperCase())
      .eq("to_currency", toCurrency.toUpperCase())
      .eq("is_historical", false)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Try reverse rate
      const { data: reverseData } = await supabaseAdmin
        .from("exchange_rates")
        .select("rate, provider")
        .eq("from_currency", toCurrency.toUpperCase())
        .eq("to_currency", fromCurrency.toUpperCase())
        .eq("is_historical", false)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reverseData) {
        const rate = 1 / reverseData.rate;
        const result = { rate: Math.round(rate * 100000000) / 100000000, provider: reverseData.provider };
        _rateCache.set(cacheKey, result);
        _lastRateRefresh = now;
        return { success: true, data: result };
      }

      return { success: false, error: "Exchange rate not available" };
    }

    const result = { rate: data.rate, provider: data.provider };
    _rateCache.set(cacheKey, result);
    _lastRateRefresh = now;
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return { success: true, data: { amount, rate: 1, fromCurrency, toCurrency } };
  }

  const rateResult = await getExchangeRate(fromCurrency, toCurrency);
  if (!rateResult.success) return rateResult;

  const converted = amount * rateResult.data.rate;
  const decimalPlaces = await _getDecimalPlaces(toCurrency);

  return {
    success: true,
    data: {
      amount: Math.round(converted * 10 ** decimalPlaces) / 10 ** decimalPlaces,
      original: amount,
      rate: rateResult.data.rate,
      provider: rateResult.data.provider,
      fromCurrency,
      toCurrency,
    },
  };
}

export async function updateExchangeRate(fromCurrency, toCurrency, rate, provider = "manual") {
  try {
    const { error } = await supabaseAdmin.from("exchange_rates").insert({
      from_currency: fromCurrency.toUpperCase(),
      to_currency: toCurrency.toUpperCase(),
      rate,
      provider,
      source: provider,
    });

    if (error) return { success: false, error: error.message };

    _rateCache.delete(`${fromCurrency}:${toCurrency}`);
    _rateCache.delete(`${toCurrency}:${fromCurrency}`);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getHistoricalRates(fromCurrency, toCurrency, days = 30) {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("exchange_rates")
      .select("rate, recorded_at")
      .eq("from_currency", fromCurrency.toUpperCase())
      .eq("to_currency", toCurrency.toUpperCase())
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function setRateProvider(provider) {
  _rateProvider = provider;
}

export function getRateProvider() {
  return _rateProvider;
}

export function clearRateCache() {
  _rateCache.clear();
  _lastRateRefresh = 0;
}

// — Formatting helpers —

export function formatCurrency(amount, currencyCode = "INR", locale = "en-IN") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount}`;
  }
}

export function formatCrypto(amount, decimals = 8) {
  return amount.toFixed(decimals);
}

// — Internal —

async function _getDecimalPlaces(currencyCode) {
  try {
    const { data } = await supabaseAdmin
      .from("currencies")
      .select("decimal_places")
      .eq("code", currencyCode.toUpperCase())
      .single();

    return data?.decimal_places || 2;
  } catch {
    return 2;
  }
}
