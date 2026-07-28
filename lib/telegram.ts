import { env } from './env';
import { logActivity, supabaseAdmin } from './supabase-admin';

type TelegramResponse<T = unknown> = { ok: boolean; result?: T; description?: string };

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function telegramApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${env().TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const payload = await response.json() as TelegramResponse<T>;
  if (!response.ok || !payload.ok) throw new Error(payload.description ?? `Telegram ${method} failed`);
  return payload.result as T;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: Record<string, unknown> = {},
  actor = 'bot',
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  });
  await logActivity({
    category: 'telegram',
    action: 'bot_response',
    actor,
    payload: { chatId: String(chatId), text: text.slice(0, 3500) },
  });
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🩺 Health', callback_data: 'cmd:health' },
        { text: '🎯 Signals', callback_data: 'cmd:signals' },
      ],
      [
        { text: '📈 Paper Trades', callback_data: 'cmd:trades' },
        { text: '👑 BOSS', callback_data: 'cmd:boss' },
      ],
      [{ text: '🌐 Dashboard', url: `${env().PUBLIC_BASE_URL.replace(/\/$/, '')}/admin` }],
    ],
  };
}

function money(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00';
}

async function healthText(): Promise<string> {
  const db = supabaseAdmin();
  const [{ count: open }, { data: recentJob }, { data: runtime }] = await Promise.all([
    db.from('paper_positions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('job_runs').select('job_name,status,finished_at,summary').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('strategy_runtime').select('strategy,enabled,consecutive_losses,paused_until,daily_pnl_usd').order('strategy'),
  ]);
  const runtimeLines = (runtime ?? []).map((row: any) =>
    `${row.enabled ? '✅' : '⛔'} ${row.strategy}: losses ${row.consecutive_losses}, daily ${money(row.daily_pnl_usd)}`,
  ).join('\n');
  return [
    '<b>MoonShotForge Health</b>',
    '🧾 Mode: <b>PAPER ONLY</b>',
    `📂 Open positions: <b>${open ?? 0}</b>`,
    `⚙️ Last job: <b>${escapeHtml(recentJob?.job_name ?? 'none')}</b> · ${escapeHtml(recentJob?.status ?? 'unknown')}`,
    runtimeLines || 'No strategy runtime rows yet.',
  ].join('\n');
}

async function signalsText(): Promise<string> {
  const { data } = await supabaseAdmin()
    .from('signals')
    .select('strategy,score,symbol,mint,status,created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (!data?.length) return '<b>Recent Signals</b>\nNo qualified signals yet. Rejection reasons are visible in the dashboard.';
  return '<b>Recent Signals</b>\n' + data.map((row: any) =>
    `• <b>${escapeHtml(row.symbol ?? '???')}</b> ${row.strategy} ${Number(row.score).toFixed(1)} · ${row.status}\n  <code>${row.mint}</code>`,
  ).join('\n');
}

async function tradesText(): Promise<string> {
  const { data } = await supabaseAdmin()
    .from('paper_positions')
    .select('symbol,strategy,status,entry_price,current_price,pnl_usd,pnl_pct,exit_reason,opened_at')
    .order('opened_at', { ascending: false })
    .limit(5);
  if (!data?.length) return '<b>Paper Trades</b>\nNo paper positions yet.';
  return '<b>Paper Trades</b>\n' + data.map((row: any) =>
    `• <b>${escapeHtml(row.symbol ?? '???')}</b> ${row.strategy} · ${row.status.toUpperCase()} · ${money(row.pnl_usd)} (${Number(row.pnl_pct ?? 0).toFixed(2)}%)${row.exit_reason ? ` · ${escapeHtml(row.exit_reason)}` : ''}`,
  ).join('\n');
}

function activityLine(row: any): string {
  const when = new Date(row.occurred_at).toISOString().replace('T', ' ').slice(0, 19);
  const payload = JSON.stringify(row.payload ?? {});
  return `${when} | ${row.severity.toUpperCase()} | ${row.category}/${row.action} | ${row.actor} | ${payload}`;
}

function chunks(lines: string[], max = 3600): string[] {
  const result: string[] = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > max && current) {
      result.push(current);
      current = line;
    } else current = next;
  }
  if (current) result.push(current);
  return result;
}

async function boss(chatId: number, telegramId: string): Promise<void> {
  if (telegramId !== env().OWNER_TELEGRAM_ID) {
    await sendTelegramMessage(chatId, '⛔ <b>Owner-only control.</b>', {}, `telegram:${telegramId}`);
    return;
  }
  const db = supabaseAdmin();
  const { data: cursor } = await db.from('boss_cursors').select('last_activity_id').eq('telegram_id', telegramId).maybeSingle();
  const lastId = Number(cursor?.last_activity_id ?? 0);
  const rows: any[] = [];
  let pageAfter = lastId;

  for (;;) {
    const { data: batch, error } = await db
      .from('activity_log')
      .select('id,occurred_at,category,action,severity,actor,payload')
      .gt('id', pageAfter)
      .order('id', { ascending: true })
      .limit(1000);
    if (error) throw error;
    if (!batch?.length) break;
    rows.push(...batch);
    pageAfter = Number(batch[batch.length - 1].id);
    if (batch.length < 1000) break;
  }

  if (!rows.length) {
    await sendTelegramMessage(chatId, '👑 <b>BOSS Report</b>\nNo new recorded activity since your previous successful check.', {}, `telegram:${telegramId}`);
  } else {
    const rendered = rows.map(activityLine);
    const pages = chunks(rendered);
    for (let index = 0; index < pages.length; index++) {
      await sendTelegramMessage(
        chatId,
        `👑 <b>BOSS Report ${index + 1}/${pages.length}</b>\n<pre>${escapeHtml(pages[index])}</pre>`,
        {},
        `telegram:${telegramId}`,
      );
    }
  }

  // Advance only through the records included in this report. The report's
  // own Telegram response records are therefore included on the next press.
  await db.from('boss_cursors').upsert({
    telegram_id: telegramId,
    last_activity_id: rows.length ? Number(rows[rows.length - 1].id) : lastId,
    updated_at: new Date().toISOString(),
  });
}

async function executeCommand(command: string, chatId: number, telegramId: string): Promise<void> {
  switch (command) {
    case 'start':
    case 'menu':
      await sendTelegramMessage(
        chatId,
        '<b>MoonShotForge is online.</b>\nServerless Vercel API, Supabase persistence, Telegram webhook, and paper-only trading are connected. No separate worker process exists.',
        { reply_markup: mainKeyboard() },
        `telegram:${telegramId}`,
      );
      break;
    case 'health':
    case 'status':
      await sendTelegramMessage(chatId, await healthText(), { reply_markup: mainKeyboard() }, `telegram:${telegramId}`);
      break;
    case 'signals':
      await sendTelegramMessage(chatId, await signalsText(), { reply_markup: mainKeyboard() }, `telegram:${telegramId}`);
      break;
    case 'trades':
    case 'pnl':
      await sendTelegramMessage(chatId, await tradesText(), { reply_markup: mainKeyboard() }, `telegram:${telegramId}`);
      break;
    case 'boss':
      await boss(chatId, telegramId);
      break;
    default:
      await sendTelegramMessage(chatId, `Unknown command: <code>/${escapeHtml(command)}</code>`, { reply_markup: mainKeyboard() }, `telegram:${telegramId}`);
  }
}

export async function processTelegramUpdate(update: any): Promise<void> {
  const updateId = Number(update?.update_id);
  if (!Number.isFinite(updateId)) throw new Error('Invalid Telegram update_id');
  const db = supabaseAdmin();
  const { data: claimed, error: claimError } = await db.rpc('claim_telegram_update', {
    p_update_id: updateId,
    p_payload: update,
  });
  if (claimError) throw claimError;
  if (!claimed) return;

  try {
    const message = update?.message ?? update?.callback_query?.message;
    const from = update?.message?.from ?? update?.callback_query?.from;
    if (!message?.chat?.id || !from?.id) {
      await db.from('telegram_updates').update({ processed_at: new Date().toISOString(), processing_started_at: null }).eq('update_id', updateId);
      return;
    }
    const chatId = Number(message.chat.id);
    const telegramId = String(from.id);
    const username = from.username ? String(from.username) : null;
    const isOwner = telegramId === env().OWNER_TELEGRAM_ID;

    const { error: userError } = await db.from('bot_users').upsert({
      telegram_id: telegramId,
      chat_id: String(chatId),
      username,
      first_name: from.first_name ? String(from.first_name) : null,
      is_owner: isOwner,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (userError) throw userError;

    let command = '';
    let action = 'message';
    if (update.callback_query) {
      action = 'button_press';
      const data = String(update.callback_query.data ?? '');
      command = data.startsWith('cmd:') ? data.slice(4) : '';
      await telegramApi('answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(() => undefined);
    } else {
      const text = String(update.message?.text ?? '').trim();
      command = text.startsWith('/') ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : '';
    }

    await logActivity({
      category: 'telegram',
      action,
      actor: `telegram:${telegramId}`,
      payload: { updateId, command, username, chatId },
    });

    if (command) await executeCommand(command, chatId, telegramId);
    const { error: processedError } = await db.from('telegram_updates').update({
      processed_at: new Date().toISOString(),
      processing_started_at: null,
    }).eq('update_id', updateId);
    if (processedError) throw processedError;
  } catch (error) {
    await db.from('telegram_updates').update({ processing_started_at: null }).eq('update_id', updateId);
    await logActivity({
      category: 'telegram',
      action: 'update_failed',
      severity: 'error',
      actor: 'telegram-webhook',
      payload: { updateId, error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

export async function notifySignal(signal: {
  symbol: string;
  mint: string;
  strategy: string;
  score: number;
  priceUsd: number;
  liquidityUsd: number;
}): Promise<void> {
  const { data: users } = await supabaseAdmin().from('bot_users').select('chat_id').eq('enabled', true);
  const recipients = new Set<string>((users ?? []).map((row: any) => String(row.chat_id)));
  recipients.add(env().OWNER_TELEGRAM_ID);
  const text = [
    `🎯 <b>${escapeHtml(signal.strategy)} PAPER SIGNAL</b>`,
    `<b>${escapeHtml(signal.symbol)}</b> · score ${signal.score.toFixed(1)}`,
    `Price: ${signal.priceUsd.toPrecision(6)}`,
    `Liquidity: ${money(signal.liquidityUsd)}`,
    `<code>${signal.mint}</code>`,
    '<i>No live order was submitted.</i>',
  ].join('\n');
  await Promise.allSettled([...recipients].map(chatId => sendTelegramMessage(chatId, text, { reply_markup: mainKeyboard() }, 'signal-engine')));
}

export async function notifyPositionClose(position: {
  symbol: string;
  strategy: string;
  pnlUsd: number;
  pnlPct: number;
  reason: string;
}): Promise<void> {
  const icon = position.pnlUsd >= 0 ? '✅' : '🛑';
  await sendTelegramMessage(
    env().OWNER_TELEGRAM_ID,
    `${icon} <b>PAPER POSITION CLOSED</b>\n${escapeHtml(position.symbol)} · ${escapeHtml(position.strategy)}\nP&amp;L: ${money(position.pnlUsd)} (${position.pnlPct.toFixed(2)}%)\nReason: ${escapeHtml(position.reason)}`,
    { reply_markup: mainKeyboard() },
    'position-monitor',
  );
}
