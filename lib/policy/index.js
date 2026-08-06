/**
 * Policy Module — Barrel exports.
 *
 * Re-exports all policy management functions for easy importing.
 *
 * Usage:
 *   import { createPolicy, evaluatePolicy, getActivePolicies } from "@/lib/policy";
 *   import { updatePolicyValue, initializeDefaultPolicies } from "@/lib/policy";
 */

export {
  createPolicy,
  getPolicy,
  getPolicyByKey,
  getPolicies,
  updatePolicyValue,
  getPolicyVersions,
  evaluatePolicy,
  getActivePolicies,
  initializeDefaultPolicies,
  POLICY_CATEGORIES,
  POLICY_TYPES,
} from "./policyEngine";
