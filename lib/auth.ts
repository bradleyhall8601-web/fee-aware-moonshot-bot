import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

export const ADMIN_COOKIE = 'moonshot_admin';
const SESSION_SECONDS = 12 * 60 * 60;

function sign(payload: string): string {
  return createHmac('sha256', env().ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}

export function createAdminSession(): string {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `owner.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  const expires = Number(parts[1]);
  return parts[0] === 'owner' && Number.isFinite(expires) && expires > Date.now() / 1000;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

export function passwordMatches(value: string): boolean {
  const expected = Buffer.from(env().ADMIN_PASSWORD);
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}

export function authorizedSecret(request: Request, expected: string): boolean {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${expected}`;
}
