import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getBankAccounts } from "../../../lib/verification/bankVerification";
import { createBankAccount } from "../../../lib/verification/bankVerification";
import { updateBankAccount } from "../../../lib/verification/bankVerification";
import { deleteBankAccount } from "../../../lib/verification/bankVerification";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const accounts = await getBankAccounts(user.id);
      return res.status(200).json({ success: true, ...accounts });
    } catch (err) {
      console.error("Get bank accounts error:", err);
      return res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType, upiId } = req.body;
      const result = await createBankAccount(user.id, {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        branchName,
        accountType,
        upiId,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Create bank account error:", err);
      return res.status(500).json({ error: "Failed to create bank account" });
    }
  }

  if (req.method === "PUT") {
    if (!rl(req, res)) return;

    try {
      const { accountId, updates } = req.body;
      const result = await updateBankAccount(user.id, accountId, updates);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Update bank account error:", err);
      return res.status(500).json({ error: "Failed to update bank account" });
    }
  }

  if (req.method === "DELETE") {
    if (!rl(req, res)) return;

    try {
      const { accountId } = req.body;
      const result = await deleteBankAccount(user.id, accountId);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Delete bank account error:", err);
      return res.status(500).json({ error: "Failed to delete bank account" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
