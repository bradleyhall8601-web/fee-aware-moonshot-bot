import { env } from '@/lib/env';
import { processTelegramUpdate } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const supplied = request.headers.get('x-telegram-bot-api-secret-token');
  if (supplied !== env().TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ ok: false, error: 'invalid webhook secret' }, { status: 401 });
  }
  try {
    const update = await request.json();
    await processTelegramUpdate(update);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[telegram-webhook]', error);
    return Response.json({ ok: false, error: 'processing failed' }, { status: 500 });
  }
}
