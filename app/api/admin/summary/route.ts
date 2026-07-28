import { isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [open, signalsToday, closed, candidates, jobs, runtime, recentSignals, recentPositions] = await Promise.all([
    db.from('paper_positions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('signals').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    db.from('paper_positions').select('pnl_usd,pnl_pct').eq('status', 'closed').gte('closed_at', today.toISOString()),
    db.from('candidates').select('*', { count: 'exact', head: true }).gte('observed_at', today.toISOString()),
    db.from('job_runs').select('job_name,status,started_at,finished_at,summary').order('started_at', { ascending: false }).limit(8),
    db.from('strategy_runtime').select('*').order('strategy'),
    db.from('signals').select('*').order('created_at', { ascending: false }).limit(10),
    db.from('paper_positions').select('*').order('opened_at', { ascending: false }).limit(10),
  ]);
  const closedRows = closed.data ?? [];
  const wins = closedRows.filter((row: any) => Number(row.pnl_usd) > 0).length;
  return Response.json({
    counts: {
      openPositions: open.count ?? 0,
      signalsToday: signalsToday.count ?? 0,
      candidatesToday: candidates.count ?? 0,
      closedToday: closedRows.length,
    },
    pnl: {
      todayUsd: closedRows.reduce((sum: number, row: any) => sum + Number(row.pnl_usd ?? 0), 0),
      winRate: closedRows.length ? (wins / closedRows.length) * 100 : 0,
    },
    jobs: jobs.data ?? [],
    runtime: runtime.data ?? [],
    recentSignals: recentSignals.data ?? [],
    recentPositions: recentPositions.data ?? [],
  });
}
