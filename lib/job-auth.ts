import { env } from './env';
import { authorizedSecret } from './auth';

export function requireCron(request: Request): Response | null {
  if (authorizedSecret(request, env().CRON_SECRET)) return null;
  return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

export function requireDeploySecret(request: Request): Response | null {
  if (authorizedSecret(request, env().DEPLOY_SECRET)) return null;
  return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}
