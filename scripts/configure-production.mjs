const required = ['PUBLIC_BASE_URL','DEPLOY_SECRET'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const base = process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
const response = await fetch(`${base}/api/deploy/configure`, {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.DEPLOY_SECRET}` },
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Production configuration failed: ${JSON.stringify(body)}`);
console.log('Production connections:', body);

const health = await fetch(`${base}/api/health`);
const healthBody = await health.json().catch(() => ({}));
if (!health.ok) throw new Error(`Health check failed: ${JSON.stringify(healthBody)}`);
console.log('Health:', healthBody);
