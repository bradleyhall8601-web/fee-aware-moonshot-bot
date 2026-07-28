import { randomBytes } from 'node:crypto';

const token = bytes => randomBytes(bytes).toString('base64url');
console.log(`ADMIN_SESSION_SECRET=${token(48)}`);
console.log(`CRON_SECRET=${token(36)}`);
console.log(`DEPLOY_SECRET=${token(36)}`);
console.log(`TELEGRAM_WEBHOOK_SECRET=${token(32)}`);
console.error('ADMIN_PASSWORD should be a unique password stored only in Vercel.');
