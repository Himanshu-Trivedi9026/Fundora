/**
 * Escrow Module — Public API
 *
 * Re-exports all escrow functions for easy importing.
 *
 * Usage:
 *   import { createEscrowAccount, releaseFunds } from "@/lib/escrow";
 *   import { processRefund, createSettlementBatch } from "@/lib/escrow";
 *   import { getActiveProvider, registerProvider } from "@/lib/escrow";
 */

// ─── Escrow Account ───
export {
  createEscrowAccount,
  getEscrowAccount,
  getEscrowAccountByCampaign,
  getEscrowAccountsByCreator,
  updateEscrowStatus,
  freezeEscrowAccount,
  unfreezeEscrowAccount,
  closeEscrowAccount,
  ESCROW_STATUSES,
  STATUS_TRANSITIONS,
} from "./escrowAccount";

// ─── Escrow Ledger ───
export {
  createLedgerEntry,
  getLedgerEntries,
  getLedgerBalance,
  getLedgerSummary,
  validateLedgerIntegrity,
} from "./escrowLedger";

// ─── Escrow Rules ───
export {
  canRelease,
  canRefund,
  canPayout,
  calculatePlatformFee,
  calculateCreatorEarning,
  getEscrowStatus,
  validateAmount,
} from "./escrowRules";

// ─── Escrow Events ───
export {
  recordEscrowEvent,
  getEscrowEvents,
  getEscrowEventSummary,
} from "./escrowEvents";

// ─── Release Engine ───
export {
  releaseFunds,
  emergencyFreeze,
  emergencyCancel,
  scheduledRelease,
} from "./releaseEngine";

// ─── Refund Engine ───
export { processRefund, partialRefund, fullRefund } from "./refundEngine";

// ─── Settlement Engine ───
export {
  createSettlementBatch,
  addToSettlementBatch,
  processSettlementBatch,
  getSettlementBatch,
  getSettlementBatches,
} from "./settlementEngine";

// ─── Provider Adapter ───
export {
  BasePayoutProvider,
  MockPayoutProvider,
  RazorpayPayoutProvider,
  CashfreePayoutProvider,
  StripePayoutProvider,
  registerProvider,
  getProvider,
  setActiveProvider,
  getActiveProvider,
  listProviders,
  initializeDefaultProviders,
} from "./providerAdapter";
