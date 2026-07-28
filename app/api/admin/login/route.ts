import { ADMIN_COOKIE, createAdminSession, passwordMatches, sessionCookieOptions } from '@/lib/auth';
import { logActivity, supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const actor = `ip:${forwarded}`;
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin()
    .from('activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'admin')
    .eq('action', 'login_failed')
    .eq('actor', actor)
    .gte('occurred_at', since);
  if ((count ?? 0) >= 8) {
    await logActivity({ category: 'admin', action: 'login_rate_limited', severity: 'warn', actor, payload: {} });
    return NextResponse.redirect(new URL('/admin/login?error=locked', request.url), 303);
  }
  if (!passwordMatches(password)) {
    await logActivity({ category: 'admin', action: 'login_failed', severity: 'warn', actor, payload: {} });
    return NextResponse.redirect(new URL('/admin/login?error=1', request.url), 303);
  }
  const response = NextResponse.redirect(new URL('/admin', request.url), 303);
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), sessionCookieOptions());
  await logActivity({ category: 'admin', action: 'login_success', actor, payload: {} });
  return response;
}
