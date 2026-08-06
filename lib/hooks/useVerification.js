/**
 * useVerification — Standalone hook for verification state.
 *
 * Re-exports from VerificationContext for convenience.
 * Components should import from this file for cleaner imports.
 *
 * Usage:
 *   import { useVerification } from "@/lib/hooks/useVerification";
 *   const { verification, loading, levelLabel, isVerified } = useVerification();
 */

export { useVerification, VERIFICATION_LEVELS, VERIFICATION_STATUSES } from "../../context/VerificationContext";
