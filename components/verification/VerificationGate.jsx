import Link from "next/link";
import { useRouter } from "next/router";
import { useVerification } from "../../context/VerificationContext";
import { SecurityShield, VerificationStatus } from "../security";
import Button from "../ui/Button";

/**
 * VerificationGate — creator-verification gate screen.
 *
 * Wraps creator-area content. When the creator's verification is approved,
 * renders `children`. Otherwise renders a status-appropriate "Verification
 * Required" screen so the creator can never reach the protected content by
 * bypassing the API gates.
 *
 * States (all derived from real Supabase data via useVerification):
 *   approved          → children
 *   rejected          → Rejected screen (reason + resubmit CTA)
 *   expired/cancelled → Expired screen
 *   under review      → documents_uploaded / automatic_validation /
 *                       under_review / manual_review → "Under review" screen
 *   documents_required→ status is pending/null (or no verification request
 *                       submitted yet) → "Complete your verification" screen
 *
 * Props:
 *   children — rendered when approved.
 */
export default function VerificationGate({ children }) {
  const router = useRouter();
  const { verification, loading, requests, pendingActions, rejectedDocuments } =
    useVerification();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div
          role="status"
          aria-label="Checking verification status"
          className="text-on-surface-variant text-lg animate-pulse"
        >
          Checking verification status…
        </div>
      </div>
    );
  }

  const status = verification?.verification_status || null;

  if (status === "approved") {
    return children;
  }

  const hasSubmittedRequest = Array.isArray(requests) && requests.length > 0;

  // Derive which screen to show. `documents_required` is not a DB status —
  // it means the creator has not yet submitted verification documents, which
  // we derive from a pending/null status with no request on record.
  const UNDER_REVIEW = [
    "documents_uploaded",
    "automatic_validation",
    "under_review",
    "manual_review",
  ];

  let screen;
  if (status === "rejected") screen = "rejected";
  else if (status === "expired" || status === "cancelled") screen = "expired";
  else if (UNDER_REVIEW.includes(status)) screen = "under_review";
  else screen = "documents_required";

  const rejectionReason =
    rejectedDocuments?.[0]?.reason ||
    pendingActions?.find((a) => a.action === "rejected")?.reason ||
    "";

  const goToVerification = () => router.push("/creator/verification");

  const screens = {
    documents_required: {
      icon: "description",
      title: "Complete your creator verification",
      message:
        "Creator verification is required before you can publish campaigns or receive funds. Submit your verification documents to get started.",
      cta: "Continue verification",
    },
    under_review: {
      icon: "hourglass_top",
      title: "Verification under review",
      message:
        "Your verification documents are being reviewed. You'll be able to publish campaigns and receive funds once approved.",
      cta: "View verification status",
    },
    rejected: {
      icon: "block",
      title: "Verification rejected",
      message: rejectionReason
        ? `Your verification was rejected: ${rejectionReason}`
        : "Your verification was rejected. Review the reason, submit updated documents, and try again.",
      cta: "Review and resubmit",
    },
    expired: {
      icon: "schedule",
      title: "Verification expired",
      message:
        "Your creator verification has expired. Renew it to publish campaigns and receive funds.",
      cta: "Renew verification",
    },
  };

  const content = screens[screen];

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-4"
      role="alert"
      aria-label={content.title}
    >
      <div className="glass-card max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <SecurityShield
            level={status === "rejected" || status === "expired" ? 1 : 0}
            size="lg"
          />
        </div>

        <div className="flex justify-center">
          <VerificationStatus status={status || "pending"} size="lg" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-on-surface font-geist">
            {content.title}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {content.message}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={goToVerification}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden="true"
            >
              verified_user
            </span>
            {content.cta}
          </Button>
          <Link
            href="/"
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Go to home
          </Link>
        </div>

        {!hasSubmittedRequest && screen === "under_review" && (
          <p className="text-xs text-on-surface-variant/70">
            No documents submitted yet — this usually means you need to upload
            them in the verification flow.
          </p>
        )}
      </div>
    </div>
  );
}
