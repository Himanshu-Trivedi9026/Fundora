// Translation Service — internationalization engine for Fundora
// Supports dynamic language loading, locale routing, and pluggable translation providers

import { supabaseAdmin } from "../supabaseAdmin.js";

const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = new Set([
  "en",
  "hi",
  "bn",
  "te",
  "mr",
  "ta",
  "ur",
  "gu",
  "kn",
  "ml",
  "pa",
  "or",
  "as",
  "ar",
  "es",
  "fr",
  "de",
  "ja",
  "zh",
  "pt",
]);

const RTL_LOCALES = new Set(["ur", "ar"]);

let _translationsCache = new Map();
let _activeLocale = DEFAULT_LOCALE;
let _cacheTTL = 300000; // 5 minutes
let _lastCacheRefresh = 0;

export function isRTL(locale) {
  return RTL_LOCALES.has(locale || _activeLocale);
}

export function isSupported(locale) {
  return SUPPORTED_LOCALES.has(locale);
}

export function getActiveLocale() {
  return _activeLocale;
}

export function setActiveLocale(locale) {
  if (SUPPORTED_LOCALES.has(locale)) {
    _activeLocale = locale;
    return true;
  }
  return false;
}

export function getSupportedLocales() {
  return Array.from(SUPPORTED_LOCALES);
}

export function getLocaleDirection(locale) {
  return isRTL(locale) ? "rtl" : "ltr";
}

export async function loadTranslations(
  locale,
  namespace = "default",
  force = false,
) {
  const cacheKey = `${locale}:${namespace}`;
  const now = Date.now();

  if (
    !force &&
    _translationsCache.has(cacheKey) &&
    now - _lastCacheRefresh < _cacheTTL
  ) {
    return { success: true, data: _translationsCache.get(cacheKey) };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("translation_entries")
      .select("key, value, plural_value")
      .eq("locale", locale)
      .eq("namespace", namespace)
      .eq("is_approved", true);

    if (error) return { success: false, error: error.message };

    const translations = {};
    for (const entry of data || []) {
      translations[entry.key] = entry.value;
      if (entry.plural_value) {
        translations[`${entry.key}_plural`] = entry.plural_value;
      }
    }

    _translationsCache.set(cacheKey, translations);
    _lastCacheRefresh = now;

    return { success: true, data: translations };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function loadAllTranslations(locale) {
  try {
    const { data, error } = await supabaseAdmin
      .from("translation_entries")
      .select("namespace, key, value, plural_value")
      .eq("locale", locale)
      .eq("is_approved", true);

    if (error) return { success: false, error: error.message };

    const grouped = {};
    for (const entry of data || []) {
      if (!grouped[entry.namespace]) grouped[entry.namespace] = {};
      grouped[entry.namespace][entry.key] = entry.value;
      if (entry.plural_value) {
        grouped[entry.namespace][`${entry.key}_plural`] = entry.plural_value;
      }
    }

    return { success: true, data: grouped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function addTranslation(locale, namespace, key, value, userId) {
  try {
    const { error } = await supabaseAdmin.from("translation_entries").upsert(
      {
        locale,
        namespace,
        key,
        value,
        is_approved: false,
        is_stale: false,
      },
      { onConflict: "locale,namespace,key" },
    );

    if (error) return { success: false, error: error.message };

    // Invalidate cache
    _translationsCache.delete(`${locale}:${namespace}`);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getLanguagePack(locale) {
  try {
    const { data, error } = await supabaseAdmin
      .from("language_packs")
      .select("*")
      .eq("locale", locale)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listLanguagePacks() {
  try {
    const { data, error } = await supabaseAdmin
      .from("language_packs")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function t(key, params = {}, locale = _activeLocale) {
  const cacheKey = `${locale}:default`;
  const translations = _translationsCache.get(cacheKey) || {};

  let value = translations[key] || key;

  // Simple parameter interpolation: {{paramName}}
  if (params && Object.keys(params).length > 0) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v);
    }
  }

  return value;
}

export function clearCache() {
  _translationsCache.clear();
  _lastCacheRefresh = 0;
}

// Format localization helpers
export function formatNumber(number, locale = _activeLocale, options = {}) {
  try {
    return new Intl.NumberFormat(locale.replace("_", "-"), options).format(
      number,
    );
  } catch {
    return String(number);
  }
}

export function formatDate(date, locale = _activeLocale, options = {}) {
  try {
    return new Intl.DateTimeFormat(locale.replace("_", "-"), options).format(
      new Date(date),
    );
  } catch {
    return String(date);
  }
}

export function formatCurrency(
  amount,
  currency = "INR",
  locale = _activeLocale,
) {
  try {
    return new Intl.NumberFormat(locale.replace("_", "-"), {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function formatRelativeTime(date, locale = _activeLocale) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30)
    return formatDate(date, locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function resolveLocale(acceptLanguage, defaultLocale = DEFAULT_LOCALE) {
  if (!acceptLanguage) return defaultLocale;

  const preferred = acceptLanguage
    .split(",")
    .map((l) => {
      const parts = l.trim().split(";");
      const q = parts[1] ? parseFloat(parts[1].split("=")[1]) : 1;
      return { locale: parts[0].split("-")[0].toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const p of preferred) {
    if (SUPPORTED_LOCALES.has(p.locale)) return p.locale;
  }

  return defaultLocale;
}
