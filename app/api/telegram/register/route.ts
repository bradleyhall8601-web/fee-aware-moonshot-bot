import { env } from '@/lib/env';
import { requireDeploySecret } from '@/lib/job-auth';
import { logActivity } from '@/lib/supabase-admin';
import { telegramApi } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const denied = requireDeploySecret(request);
  if (denied) return denied;
  const e = env();
  const webhookUrl = `${e.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/telegram/webhook`;
  try {
    const result = await telegramApi('setWebhook', {
      url: webhookUrl,
      secret_token: e.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
      max_connections: 20,
    });
    const info = await telegramApi('getWebhookInfo', {});
    await logActivity({ category: 'deployment', action: 'telegram_webhook_registered', actor: 'deploy', payload: { webhookUrl, info } });
    return Response.json({ ok: true, webhookUrl, result, info });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
