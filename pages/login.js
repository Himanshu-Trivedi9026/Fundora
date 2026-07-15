import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/";
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4">
        {/* CENTER WRAPPER */}
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* LOGO + BRAND */}
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src="/logo.png"
              alt="Fundora"
              className="h-16 w-auto mb-3"
            />

            <h1 className="text-3xl font-bold text-white">
              Fundora
            </h1>

            <p className="text-sm text-slate-400 mt-1">
              Fund ideas. Fuel innovation. Empower creators.
            </p>
          </div>

          {/* LOGIN CARD */}
          <form
            onSubmit={handleLogin}
            className="w-full bg-slate-900/70 border border-slate-700 rounded-xl p-6 shadow-xl backdrop-blur"
          >
            <h2 className="text-xl font-bold text-white mb-4 text-center">
              Login
            </h2>

            {error && (
              <p className="text-red-400 text-sm mb-3 text-center">
                {error}
              </p>
            )}

            <label htmlFor="login-email" className="text-slate-300 text-sm">Email</label>
            <input
              id="login-email"
              type="email"
              className="w-full mt-1 mb-3 px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="login-password" className="text-slate-300 text-sm">Password</label>
            <input
              id="login-password"
              type="password"
              className="w-full mt-1 mb-4 px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-500 transition"
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <p className="text-slate-400 text-center text-xs mt-3">
              Don't have an account?{" "}
              <a href="/signup" className="text-cyan-400 hover:underline">
                Sign up
              </a>
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
