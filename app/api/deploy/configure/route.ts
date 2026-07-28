import { assertPaperOnly, env } from '@/lib/env';
import { requireDeploySecret } from '@/lib/job-auth';
import { logActivity, supabaseAdmin } from '@/lib/supabase-admin';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = requireDeploySecret(request);
  if (denied) return denied;
  assertPaperOnly();
  const e = env();
  const baseUrl = e.PUBLIC_BASE_URL.replace(/\/$/, '');
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  try {
    const db = supabaseAdmin();
    const { data: cron, error: cronError } = await db.rpc('configure_moonshot_cron', {
      p_base_url: baseUrl,
      p_cron_secret: e.CRON_SECRET,
    });
    if (cronError) throw cronError;

    await telegramApi('setWebhook', {
      url: webhookUrl,
      secret_token: e.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
      max_connections: 20,
    });
    const webhook = await telegramApi('getWebhookInfo', {});

    await logActivity({
      category: 'deployment',
      action: 'production_connections_configured',
      actor: 'deploy',
      payload: { baseUrl, webhookUrl, cron, webhook },
    });
    return Response.json({ ok: true, baseUrl, cron, webhook });
  } catch (error) {
    await logActivity({
      category: 'deployment',
      action: 'production_configuration_failed',
      severity: 'error',
      actor: 'deploy',
      payload: { error: error instanceof Error ? error.message : String(error) },
    });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
