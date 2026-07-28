import { isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function usd(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value ?? 0));
}

function time(value: unknown) {
  if (!value) return 'never';
  return new Date(String(value)).toLocaleString('en-US', { timeZone: 'America/Chicago' });
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = supabaseAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [open, signals, positions, jobs, runtime, configs, candidates, activity] = await Promise.all([
    db.from('paper_positions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('signals').select('*').order('created_at', { ascending: false }).limit(12),
    db.from('paper_positions').select('*').order('opened_at', { ascending: false }).limit(12),
    db.from('job_runs').select('*').order('started_at', { ascending: false }).limit(8),
    db.from('strategy_runtime').select('*').order('strategy'),
    db.from('strategy_config').select('*').order('strategy'),
    db.from('candidates').select('*', { count: 'exact', head: true }).gte('observed_at', today.toISOString()),
    db.from('activity_log').select('*').order('id', { ascending: false }).limit(20),
  ]);
  const closed = (positions.data ?? []).filter((row: any) => row.status === 'closed');
  const pnl = closed.reduce((sum: number, row: any) => sum + Number(row.pnl_usd ?? 0), 0);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><div className="eyebrow">MOONSHOTFORGE CONTROL ROOM</div><h1>Paper Engine</h1></div>
        <div className="header-actions"><span className="status-pill">● PAPER ONLY</span><form method="post" action="/api/admin/logout"><button className="button" type="submit">Log out</button></form></div>
      </header>

      <section className="metric-grid">
        <article className="metric"><span>Open positions</span><strong>{open.count ?? 0}</strong></article>
        <article className="metric"><span>Signals shown</span><strong>{signals.data?.length ?? 0}</strong></article>
        <article className="metric"><span>Candidates today</span><strong>{candidates.count ?? 0}</strong></article>
        <article className="metric"><span>Recent realized P&amp;L</span><strong>{usd(pnl)}</strong></article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-title"><h2>Strategy state</h2><span>Persisted in Supabase</span></div>
          <div className="strategy-grid">
            {(runtime.data ?? []).map((row: any) => {
              const config = (configs.data ?? []).find((item: any) => item.strategy === row.strategy);
              return <div className="strategy-card" key={row.strategy}><b>{row.strategy}</b><span>{row.enabled ? 'Enabled' : 'Disabled'}</span><small>Score gate: {Number(config?.min_score ?? 0).toFixed(0)}</small><small>Paper size: {usd(config?.paper_notional_usd)}</small><small>Losses: {row.consecutive_losses}</small><small>Daily P&amp;L: {usd(row.daily_pnl_usd)}</small><small>Paused: {time(row.paused_until)}</small></div>;
            })}
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><h2>Job heartbeat</h2><span>Supabase Cron → Vercel Functions</span></div>
          <div className="list">{(jobs.data ?? []).map((row: any) => <div className="list-row" key={row.id}><div><b>{row.job_name}</b><small>{time(row.started_at)}</small></div><span className={`job ${row.status}`}>{row.status}</span></div>)}</div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Signals</h2><span>All three scores are stored per candidate</span></div>
        <div className="table-wrap"><table><thead><tr><th>Time</th><th>Token</th><th>Strategy</th><th>Score</th><th>Status</th></tr></thead><tbody>{(signals.data ?? []).map((row: any) => <tr key={row.signal_id}><td>{time(row.created_at)}</td><td><b>{row.symbol}</b><code>{String(row.mint).slice(0, 8)}…</code></td><td>{row.strategy}</td><td>{Number(row.score).toFixed(1)}</td><td>{row.status}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Paper positions</h2><span>No wallet or live order path</span></div>
        <div className="table-wrap"><table><thead><tr><th>Opened</th><th>Token</th><th>Strategy</th><th>Entry</th><th>Current/Exit</th><th>P&amp;L</th><th>Status</th></tr></thead><tbody>{(positions.data ?? []).map((row: any) => <tr key={row.id}><td>{time(row.opened_at)}</td><td><b>{row.symbol}</b></td><td>{row.strategy}</td><td>{Number(row.entry_price).toPrecision(6)}</td><td>{Number(row.exit_price ?? row.current_price).toPrecision(6)}</td><td className={Number(row.pnl_usd) >= 0 ? 'positive' : 'negative'}>{usd(row.pnl_usd)} ({Number(row.pnl_pct ?? 0).toFixed(2)}%)</td><td>{row.status}</td></tr>)}</tbody></table></div>
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Activity ledger</h2><span>Telegram, jobs, signals, warnings, and errors</span></div>
        <div className="activity-list">{(activity.data ?? []).map((row: any) => <div className="activity-row" key={row.id}><time>{time(row.occurred_at)}</time><b>{row.category}/{row.action}</b><span>{row.actor}</span><code>{JSON.stringify(row.payload).slice(0, 220)}</code></div>)}</div>
      </section>
    </main>
  );
}
