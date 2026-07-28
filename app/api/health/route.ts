import { assertPaperOnly } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  try {
    assertPaperOnly();
    const db = supabaseAdmin();
    const [{ count: openPositions }, { data: latestJob, error }] = await Promise.all([
      db.from('paper_positions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      db.from('job_runs').select('job_name,status,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error) throw error;
    return Response.json({
      ok: true,
      service: 'moonshotforge',
      architecture: 'vercel-supabase',
      mode: 'paper-only',
      database: 'connected',
      openPositions: openPositions ?? 0,
      latestJob,
      responseMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      service: 'moonshotforge',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
