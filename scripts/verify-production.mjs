const base = process.env.PUBLIC_BASE_URL;
const cron = process.env.CRON_SECRET;
if (!base || !cron) throw new Error('PUBLIC_BASE_URL and CRON_SECRET are required');

async function request(path, options = {}) {
  const response = await fetch(`${base.replace(/\/$/,'')}${path}`, options);
  const body = await response.json().catch(() => ({}));
  console.log(path, response.status, body);
  if (!response.ok) throw new Error(`${path} failed`);
  return body;
}

await request('/api/health');
await request('/api/jobs/scan', { method:'POST', headers:{ authorization:`Bearer ${cron}` } });
await request('/api/jobs/positions', { method:'POST', headers:{ authorization:`Bearer ${cron}` } });
console.log('Production verification complete.');
