// Recovery Manager — Unit Tests
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBackupData = () =>
  Promise.resolve({
    data: {
      id: "backup-1",
      archive_type: "full",
      archive_date: new Date().toISOString(),
      archive_size: 1048576,
      checksum: "abc123",
      archive_data: "test-data",
      retention_until: new Date(Date.now() + 86400000 * 30).toISOString(),
    },
    error: null,
  });

const mockLimitResult = Promise.resolve({
  data: [
    {
      id: "backup-1",
      archive_type: "full",
      archive_date: new Date().toISOString(),
      archive_size: 1048576,
      status: "healthy",
    },
    {
      id: "backup-2",
      archive_type: "schema",
      archive_date: new Date().toISOString(),
      archive_size: 1024,
      status: "healthy",
    },
  ],
  error: null,
});

// Shared chain object supporting both query paths
const chain = {
  single: mockBackupData,
  order: vi.fn(() => ({ limit: vi.fn(() => mockLimitResult) })),
  limit: vi.fn(() => mockLimitResult),
};

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => chain),
        order: vi.fn(() => ({ limit: vi.fn(() => mockLimitResult) })),
      })),
    })),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  secureLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

const {
  verifyBackup,
  verifyAllBackups,
  validateRestorePlan,
  performRestore,
  createRecoveryPlan,
  getRecoveryPlan,
  listRecoveryPlans,
  deleteRecoveryPlan,
  initiateFailover,
  createRunbook,
  getRunbook,
  listRunbooks,
  executeRunbook,
} = await import("../../../lib/recovery/recoveryManager.js");

describe("Recovery Manager", () => {
  describe("Backup Verification", () => {
    it("should verify a backup", async () => {
      const result = await verifyBackup("backup-1");
      expect(result.success).toBe(true);
      expect(result.data.checksumValid).toBe(true);
      expect(result.data.sizeValid).toBe(true);
      expect(result.data.type).toBe("full");
    });

    it("should verify all backups", async () => {
      const result = await verifyAllBackups();
      expect(result.success).toBe(true);
      expect(result.data.total).toBeGreaterThanOrEqual(2);
      expect(typeof result.data.healthy).toBe("number");
      expect(typeof result.data.corrupt).toBe("number");
    });
  });

  describe("Restore Validation", () => {
    it("should validate a restore plan", async () => {
      const result = await validateRestorePlan("backup-1");
      expect(result.success).toBe(true);
      expect(result.data.restorePossible).toBe(true);
      expect(result.data.steps).toBeDefined();
      expect(result.data.steps.length).toBeGreaterThanOrEqual(5);
    });

    it("should perform a restore", async () => {
      const result = await performRestore("backup-1", { reason: "test" });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("completed");
      expect(result.data.backupId).toBe("backup-1");
    });
  });

  describe("Recovery Plans", () => {
    it("should create and retrieve recovery plans", () => {
      const createResult = createRecoveryPlan("test-plan", {
        description: "Test recovery plan",
        priority: "low",
        playbook: ["Step 1", "Step 2"],
      });
      expect(createResult.success).toBe(true);

      const plan = getRecoveryPlan("test-plan");
      expect(plan).toBeDefined();
      expect(plan.description).toBe("Test recovery plan");
      expect(plan.playbook).toHaveLength(2);
    });

    it("should list all recovery plans", () => {
      createRecoveryPlan("plan-a", {
        description: "Plan A",
        priority: "high",
        playbook: [],
      });
      createRecoveryPlan("plan-b", {
        description: "Plan B",
        priority: "normal",
        playbook: [],
      });

      const plans = listRecoveryPlans();
      expect(plans.length).toBeGreaterThanOrEqual(2);
      expect(plans.some((p) => p.name === "plan-a")).toBe(true);
    });

    it("should delete recovery plans", () => {
      createRecoveryPlan("delete-me", {
        description: "Delete",
        priority: "low",
        playbook: [],
      });
      const result = deleteRecoveryPlan("delete-me");
      expect(result.success).toBe(true);
      expect(getRecoveryPlan("delete-me")).toBeNull();
    });

    it("should have default plans initialized", () => {
      const defaultPlan = getRecoveryPlan("default");
      expect(defaultPlan).toBeDefined();
      expect(defaultPlan.description).toContain("Standard");
    });
  });

  describe("Failover", () => {
    it("should initiate failover with a valid plan", async () => {
      const result = await initiateFailover({
        plan: "default",
        reason: "test failover",
      });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("completed");
    });

    it("should fail without a valid plan", async () => {
      const result = await initiateFailover({ plan: "nonexistent" });
      expect(result.success).toBe(false);
    });
  });

  describe("Runbooks", () => {
    it("should create and retrieve runbooks", () => {
      const result = createRunbook("test-runbook", [
        { action: "Step 1", critical: true },
        { action: "Step 2", critical: false },
      ]);
      expect(result.success).toBe(true);
      expect(result.data.stepCount).toBe(2);

      const runbook = getRunbook("test-runbook");
      expect(runbook).toBeDefined();
      expect(runbook.steps).toHaveLength(2);
      expect(runbook.steps[0].order).toBe(1);
    });

    it("should list runbooks", () => {
      createRunbook("rb-1", [{ action: "A" }]);
      createRunbook("rb-2", [{ action: "B" }]);

      const runbooks = listRunbooks();
      expect(runbooks.length).toBeGreaterThanOrEqual(2);
    });

    it("should execute a runbook", async () => {
      createRunbook("exec-test", [
        { action: "Verify health", critical: true },
        { action: "Restore data", critical: false },
      ]);

      const result = await executeRunbook("exec-test");
      expect(result.success).toBe(true);
      expect(result.data.succeeded).toBe(2);
      expect(result.data.failed).toBe(0);
    });

    it("should have default runbooks initialized", () => {
      const dbRecovery = getRunbook("database-recovery");
      expect(dbRecovery).toBeDefined();
      expect(dbRecovery.steps.length).toBeGreaterThanOrEqual(3);
    });
  });
});
