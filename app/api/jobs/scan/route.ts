import { requireCron } from '@/lib/job-auth';
import { runScanJob } from '@/lib/pipeline/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  try {
    return Response.json(await runScanJob());
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const GET = POST;
