import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const e = env();
  client = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'moonshotforge-vercel/3.0' } },
  });
  return client;
}

export async function logActivity(input: {
  category: string;
  action: string;
  severity?: 'debug' | 'info' | 'warn' | 'error';
  actor?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin().from('activity_log').insert({
    category: input.category,
    action: input.action,
    severity: input.severity ?? 'info',
    actor: input.actor ?? 'system',
    payload: input.payload ?? {},
  });
  if (error) console.error('[activity_log]', error.message);
}
