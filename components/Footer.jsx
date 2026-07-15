export default function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200/70 bg-white/70 dark:bg-slate-900/80 dark:border-slate-700/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()}{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Fundora
          </span>
          . Built for helping makers, startups & local businesses.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <span>Terms</span>
          <span>Privacy</span>
          <span>Support</span>
        </div>
      </div>
    </footer>
  );
}
