/**
 * Admin Policy Management API — Policy engine for admins.
 *
 * GET — List policies, get by key, get versions
 * POST — Create, update, initialize defaults
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import {
  createPolicy,
  getPolicyByKey,
  getPolicies,
  updatePolicyValue,
  getPolicyVersions,
  getActivePolicies,
  initializeDefaultPolicies,
} from "../../../lib/policy/policyEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const { mode, category, policyKey, limit, offset } = req.query;

        if (mode === "list" || !mode) {
          const result = await getPolicies({
            category,
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
          });
          return res.status(200).json({
            success: true,
            ...(result.success ? result.data : { policies: [], total: 0 }),
          });
        }

        if (mode === "detail") {
          if (!policyKey)
            return res.status(400).json({ error: "policyKey is required" });
          const result = await getPolicyByKey(policyKey);
          return res.status(200).json({
            success: true,
            ...(result.success
              ? { data: result.data }
              : { error: result.error }),
          });
        }

        if (mode === "versions") {
          if (!policyKey)
            return res.status(400).json({ error: "policyKey is required" });
          const policy = await getPolicyByKey(policyKey);
          if (!policy.success)
            return res.status(404).json({ error: "Policy not found" });
          const versions = await getPolicyVersions(policy.data.id);
          return res.status(200).json({
            success: true,
            ...(versions.success ? { data: versions.data } : { data: [] }),
          });
        }

        if (mode === "active") {
          const result = await getActivePolicies();
          return res
            .status(200)
            .json({ success: true, data: result.success ? result.data : [] });
        }

        return res.status(400).json({ error: "Invalid mode" });
      } catch (err) {
        logError("PolicyManagementAPI", "GET error", { error: err.message });
        return res.status(500).json({ error: "Failed to fetch policies" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const { action, ...params } = req.body;

        if (action === "create_policy") {
          const {
            policyKey,
            name,
            description,
            category,
            policyType,
            value,
            defaultValue,
            minValue,
            maxValue,
            allowedValues,
          } = params;
          if (
            !policyKey ||
            !name ||
            !category ||
            !policyType ||
            value === undefined
          ) {
            return res.status(400).json({
              error:
                "policyKey, name, category, policyType, and value are required",
            });
          }
          const result = await createPolicy({
            policyKey,
            name,
            description,
            category,
            policyType,
            value,
            defaultValue,
            minValue,
            maxValue,
            allowedValues,
            createdBy: user.id,
          });
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(201).json({ success: true, data: result.data });
        }

        if (action === "update_policy") {
          const { policyKey, value, changeReason } = params;
          if (!policyKey || value === undefined)
            return res
              .status(400)
              .json({ error: "policyKey and value are required" });
          const policy = await getPolicyByKey(policyKey);
          if (!policy.success)
            return res.status(404).json({ error: "Policy not found" });
          const result = await updatePolicyValue(
            policy.data.id,
            value,
            changeReason || "Admin update",
            user.id,
          );
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(200).json({ success: true, data: result.data });
        }

        if (action === "initialize_defaults") {
          const result = await initializeDefaultPolicies(user.id);
          if (!result.success)
            return res.status(400).json({ error: result.error });
          return res.status(200).json({ success: true, data: result.data });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("PolicyManagementAPI", "POST error", { error: err.message });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);
