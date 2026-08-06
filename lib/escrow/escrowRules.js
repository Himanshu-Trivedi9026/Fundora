/**
 * Escrow Rules — Business rules for escrow operations.
 *
 * Defines validation and authorization rules for:
 *   - Fund releases
 *   - Refunds
 *   - Payouts
 *   - Fee calculations
 *   - Amount validation
 *
 * These rules are pure functions with no side effects.
 * They are used by releaseEngine, refundEngine, and settlementEngine
 * to validate operations before execution.
 */

import { logWarn } from "../verification/secureLogger";

// ─── Constants ───

/**
 * Minimum amount for any transaction (in cents, e.g., 100 = $1.00).
 * @type {number}
 */
const MIN_TRANSACTION_AMOUNT = 100;

/**
 * Maximum single transaction amount (in cents).
 * @type {number}
 */
const MAX_TRANSACTION_AMOUNT = 100000000; // $1,000,000.00

/**
 * Frozen statuses that block all operations.
 * @type {string[]}
 */
const FROZEN_STATUSES = ["frozen"];

/**
 * Terminal statuses that allow no further mutations except closing.
 * @type {string[]}
 */
const TERMINAL_STATUSES = ["fully_released", "refunded", "cancelled", "closed"];

// ─── Core Functions ───

/**
 * Check if a fund release is allowed.
 * Conditions:
 *   - Escrow account exists and is active or partially_released
 *   - Account is not frozen
 *   - Account is not in a terminal state
 *   - Sufficient locked balance available
 *   - Amount is valid
 *
 * @param {Object} escrowAccount — Escrow account record
 * @param {number} amount — Amount to release (in cents)
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canRelease(escrowAccount, amount) {
  try {
    if (!escrowAccount) {
      return { allowed: false, reason: "Escrow account not found" };
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { allowed: false, reason: amountValidation.error };
    }

    // Check if frozen
    if (FROZEN_STATUSES.includes(escrowAccount.status)) {
      return { allowed: false, reason: "Escrow account is frozen" };
    }

    // Check if in terminal state
    if (TERMINAL_STATUSES.includes(escrowAccount.status)) {
      return {
        allowed: false,
        reason: `Cannot release from '${escrowAccount.status}' status`,
      };
    }

    // Check if account is active or partially_released
    const allowedStatuses = ["active", "partially_released"];
    if (!allowedStatuses.includes(escrowAccount.status)) {
      return {
        allowed: false,
        reason: `Cannot release from '${escrowAccount.status}' status`,
      };
    }

    // Check sufficient balance
    const availableBalance = escrowAccount.locked_balance || 0;
    if (amount > availableBalance) {
      return {
        allowed: false,
        reason: `Insufficient locked balance. Available: ${availableBalance}, requested: ${amount}`,
      };
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: "Release validation failed" };
  }
}

/**
 * Check if a refund is allowed.
 * Conditions:
 *   - Escrow account exists
 *   - Account is not in fully_released status
 *   - Account is not cancelled or closed
 *   - Sufficient locked balance available
 *   - Amount is valid
 *
 * @param {Object} escrowAccount — Escrow account record
 * @param {number} amount — Amount to refund (in cents)
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canRefund(escrowAccount, amount) {
  try {
    if (!escrowAccount) {
      return { allowed: false, reason: "Escrow account not found" };
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { allowed: false, reason: amountValidation.error };
    }

    // Check if cancelled or closed
    if (escrowAccount.status === "cancelled") {
      return { allowed: false, reason: "Cannot refund a cancelled account" };
    }

    if (escrowAccount.status === "closed") {
      return { allowed: false, reason: "Cannot refund a closed account" };
    }

    if (escrowAccount.status === "fully_released") {
      return {
        allowed: false,
        reason: "Cannot refund a fully released account",
      };
    }

    // Check sufficient balance
    const availableBalance = escrowAccount.locked_balance || 0;
    if (amount > availableBalance) {
      return {
        allowed: false,
        reason: `Insufficient locked balance for refund. Available: ${availableBalance}, requested: ${amount}`,
      };
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: "Refund validation failed" };
  }
}

/**
 * Check if a payout (to creator) is allowed.
 * Conditions:
 *   - Escrow account exists
 *   - Account is not frozen
 *   - Account is in a valid payout state (active or partially_released)
 *   - Sufficient creator earnings available
 *   - Amount is valid
 *
 * @param {Object} escrowAccount — Escrow account record
 * @param {number} amount — Payout amount (in cents)
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canPayout(escrowAccount, amount) {
  try {
    if (!escrowAccount) {
      return { allowed: false, reason: "Escrow account not found" };
    }

    // Validate amount
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return { allowed: false, reason: amountValidation.error };
    }

    // Check if frozen
    if (FROZEN_STATUSES.includes(escrowAccount.status)) {
      return { allowed: false, reason: "Escrow account is frozen" };
    }

    // Check if in terminal state
    if (TERMINAL_STATUSES.includes(escrowAccount.status)) {
      return {
        allowed: false,
        reason: `Cannot payout from '${escrowAccount.status}' status`,
      };
    }

    // Check if account is in a valid payout state
    const allowedStatuses = ["active", "partially_released"];
    if (!allowedStatuses.includes(escrowAccount.status)) {
      return {
        allowed: false,
        reason: `Cannot payout from '${escrowAccount.status}' status`,
      };
    }

    // Check sufficient creator earnings
    const availableEarnings = escrowAccount.creator_earnings || 0;
    if (amount > availableEarnings) {
      return {
        allowed: false,
        reason: `Insufficient creator earnings. Available: ${availableEarnings}, requested: ${amount}`,
      };
    }

    return { allowed: true };
  } catch (err) {
    return { allowed: false, reason: "Payout validation failed" };
  }
}

/**
 * Calculate platform fee from a gross amount.
 *
 * @param {number} amount — Gross amount (in cents)
 * @param {number} feePercentage — Platform fee percentage (0-100)
 * @returns {{fee: number, net: number}} Fee amount and net amount after fees
 */
export function calculatePlatformFee(amount, feePercentage) {
  try {
    if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
      return { fee: 0, net: 0 };
    }

    if (
      typeof feePercentage !== "number" ||
      isNaN(feePercentage) ||
      feePercentage < 0 ||
      feePercentage > 100
    ) {
      return { fee: 0, net: amount };
    }

    const fee = Math.round(amount * (feePercentage / 100) * 100) / 100;
    const net = Math.round((amount - fee) * 100) / 100;

    return { fee, net };
  } catch (err) {
    return { fee: 0, net: amount };
  }
}

/**
 * Calculate creator earnings after platform fees.
 *
 * @param {number} amount — Total amount (in cents)
 * @param {number} feePercentage — Platform fee percentage (0-100)
 * @returns {{creatorEarning: number, platformFee: number}}
 */
export function calculateCreatorEarning(amount, feePercentage) {
  try {
    const { fee, net } = calculatePlatformFee(amount, feePercentage);

    return {
      creatorEarning: net,
      platformFee: fee,
    };
  } catch (err) {
    return { creatorEarning: 0, platformFee: 0 };
  }
}

/**
 * Determine the appropriate status from account balances.
 * This is a pure function — it inspects balances and returns the status.
 *
 * @param {Object} escrowAccount — Escrow account record
 * @returns {string} The determined status
 */
export function getEscrowStatus(escrowAccount) {
  try {
    if (!escrowAccount) return "unknown";

    // If already frozen, closed, cancelled, or refunded, keep that status
    if (
      ["frozen", "closed", "cancelled", "refunded"].includes(
        escrowAccount.status,
      )
    ) {
      return escrowAccount.status;
    }

    const lockedBalance = escrowAccount.locked_balance || 0;
    const releasedBalance = escrowAccount.released_balance || 0;
    const refundedBalance = escrowAccount.refunded_balance || 0;
    const totalDeposits = lockedBalance + releasedBalance + refundedBalance;

    // All funds released
    if (lockedBalance === 0 && releasedBalance > 0 && refundedBalance === 0) {
      return "fully_released";
    }

    // Partially released or refunded
    if (releasedBalance > 0 || refundedBalance > 0) {
      return "partially_released";
    }

    // Has locked funds
    if (lockedBalance > 0) {
      return "active";
    }

    // Fresh account with no activity
    return "created";
  } catch (err) {
    return "unknown";
  }
}

/**
 * Validate a monetary amount.
 * Must be a positive number within allowed range.
 *
 * @param {number} amount — Amount to validate (in cents)
 * @returns {{valid: boolean, error?: string}}
 */
export function validateAmount(amount) {
  if (amount === null || amount === undefined) {
    return { valid: false, error: "Amount is required" };
  }

  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Amount must be a valid number" };
  }

  if (!Number.isFinite(amount)) {
    return { valid: false, error: "Amount must be a finite number" };
  }

  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  if (amount < MIN_TRANSACTION_AMOUNT) {
    return {
      valid: false,
      error: `Amount must be at least ${MIN_TRANSACTION_AMOUNT} cents ($${(MIN_TRANSACTION_AMOUNT / 100).toFixed(2)})`,
    };
  }

  if (amount > MAX_TRANSACTION_AMOUNT) {
    return {
      valid: false,
      error: `Amount must not exceed ${MAX_TRANSACTION_AMOUNT} cents ($${(MAX_TRANSACTION_AMOUNT / 100).toFixed(2)})`,
    };
  }

  // Check for excessive decimal places (max 2 for currency)
  const decimalPart = amount.toString().split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return {
      valid: false,
      error: "Amount cannot have more than 2 decimal places",
    };
  }

  return { valid: true };
}
