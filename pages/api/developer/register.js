// POST /api/developer/register — Register as a platform developer
import { withAuth } from "../../../lib/withAuth.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const userId = req.user?.id;
    const { organizationName, website, bio } = req.body;

    if (!organizationName) {
      return res.status(400).json({ success: false, error: "organizationName required" });
    }

    // In production: create developer profile in DB
    await logAuditEvent({
      action: "developer.register",
      actorId: userId,
      targetType: "developer_profile",
      metadata: { organizationName, website },
    });

    return res.status(201).json({
      success: true,
      data: {
        userId,
        organizationName,
        website: website || null,
        bio: bio || null,
        verified: false,
        registeredAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
