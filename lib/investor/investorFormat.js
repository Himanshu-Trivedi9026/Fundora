/**
 * lib/investor/investorFormat.js
 *
 * Shared formatting helpers for the investor area. Centralized so the Overview
 * home page and the Analytics page render currency and dates identically
 * (the ₹ en-IN formatting is currently duplicated inline in several pages).
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * Format a rupee amount with Indian digit grouping, e.g. ₹1,50,000.
 * Invalid / null amounts render as ₹0 (never "NaN" or "₹0.00").
 *
 * @param {number|string|null} amount
 * @returns {string}
 */
export function formatINR(amount) {
  if (amount == null || isNaN(Number(amount))) return "₹0";
  return inrFormatter.format(Number(amount));
}

/**
 * Compact month label, e.g. new Date("2026-07-05") -> "Jul 26".
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function monthLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en", { month: "short", year: "2-digit" });
}

/**
 * Sortable "YYYY-MM" key for a date (used to order month buckets that render
 * as "Jul 26" labels).
 *
 * @param {Date} date
 * @returns {string}
 */
export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
