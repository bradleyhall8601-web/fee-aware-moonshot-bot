# Active architecture

```text
Telegram ─HTTPS webhook─► Vercel /api/telegram/webhook
                              │
Browser ─────────────────► Vercel Next.js + owner admin
                              │ service-role, server only
                              ▼
                         Supabase Postgres
                              ▲
Supabase Cron ─HTTP───────────┼─► /api/jobs/scan
                              └─► /api/jobs/positions
```

Supabase holds every durable state transition. Vercel functions are short-lived and idempotent. No always-on application server is required.
