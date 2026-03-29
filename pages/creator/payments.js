import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function CreatorPayments() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setLoading(false);
      setMessage("Please login first.");
      return;
    }

    const res = await fetch("/api/creator/razorpay-config", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data?.error || "Failed to load config");
      setLoading(false);
      return;
    }

    setConfigured(Boolean(data?.configured));
    setKeyId(data?.keyId || "");
    setLoading(false);
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!keyId.trim() || !keySecret.trim()) {
      setMessage("Enter both Razorpay Key ID and Key Secret.");
      return;
    }

    setSaving(true);
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSaving(false);
      setMessage("Please login first.");
      return;
    }

    const res = await fetch("/api/creator/razorpay-config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSaving(false);
      setMessage(data?.error || "Failed to save config");
      return;
    }

    setConfigured(true);
    setKeySecret("");
    setSaving(false);
    setMessage(
      "Saved. This Razorpay account will be used for all your projects.",
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full p-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          Payment Management
        </h1>
        <p className="text-slate-400 mb-8">
          Add Razorpay credentials once. The same account will be used for
          funding on all projects created by you.
        </p>

        <form
          onSubmit={handleSave}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Razorpay Key ID
            </label>
            <input
              type="text"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_live_xxxxxxxxxx"
              className="input"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Razorpay Key Secret
            </label>
            <input
              type="password"
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              placeholder="Enter key secret"
              className="input"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || saving}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading
              ? "Loading..."
              : saving
                ? "Saving..."
                : configured
                  ? "Update Razorpay Credentials"
                  : "Save Razorpay Credentials"}
          </button>

          {message ? <p className="text-sm text-slate-300">{message}</p> : null}
        </form>
      </main>

      <Footer />
    </div>
  );
}
