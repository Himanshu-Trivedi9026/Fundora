import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function DeleteAccount() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  async function handleDelete() {
    if (!confirm("Are you sure you want to permanently delete your account?")) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get fresh session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Deletion failed");
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("Delete error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  if (!user)
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white"
        role="status"
      >
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto p-6 text-white">
        <h1 className="text-2xl font-bold mb-4">Delete Account</h1>

        <p className="text-slate-300 mb-6">
          This action is permanent. Your profile, projects, saved items, and
          account will be removed forever and cannot be restored.
        </p>

        {error && (
          <div
            className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg text-lg font-semibold transition disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Delete My Account"}
        </button>
      </main>

      <Footer />
    </div>
  );
}
