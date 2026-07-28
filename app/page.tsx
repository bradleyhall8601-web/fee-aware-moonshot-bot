import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="hero-card">
        <div className="eyebrow">VERCEL + SUPABASE</div>
        <h1>MoonShotForge</h1>
        <p className="hero-copy">A paper-only Solana signal engine with deterministic strategy scoring, persistent jobs, Telegram webhooks, and a database-backed control room.</p>
        <div className="architecture-row">
          <span>▲ Vercel</span><span>◈ Supabase</span><span>✈ Telegram</span>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/admin">Open Admin</Link>
          <Link className="button" href="/api/health">Health JSON</Link>
        </div>
        <p className="safety-note">Live trading is hard-disabled. Every opened position is simulated and persisted as paper activity.</p>
      </section>
    </main>
  );
}
