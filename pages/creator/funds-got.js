import { useEffect, useState, useCallback } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { supabase } from "../../lib/supabaseClient";

export default function FundsGot() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFunds = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("public_donations")
        .select(
          `
          id,
          amount,
          status,
          created_at,
          projects!inner (
            title,
            owner_id
          )
        `,
        )
        .eq("projects.owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setPayments([]);
        setTotal(0);
        return;
      }

      setPayments(data || []);
      setTotal((data || []).reduce((s, p) => s + p.amount, 0));
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Funds Got</h1>

        <p className="text-green-400 mb-6 font-semibold">
          Total Earned: ₹{total}
        </p>

        {loading && (
          <p className="text-slate-400" role="status">
            Loading funds...
          </p>
        )}

        {!loading && payments.length === 0 && (
          <p className="text-slate-400" role="status">
            No funds received yet.
          </p>
        )}

        <div className="space-y-4">
          {payments.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex justify-between"
            >
              <div>
                <p className="text-white font-semibold">{p.projects.title}</p>
                <p className="text-slate-400 text-sm">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </div>

              <div className="text-right">
                <p className="text-green-400 font-semibold">₹{p.amount}</p>
                <p className="text-xs text-slate-400 capitalize">{p.status}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
