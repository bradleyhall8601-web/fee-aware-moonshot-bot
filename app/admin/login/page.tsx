export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <form className="login-card" method="post" action="/api/admin/login">
        <div className="eyebrow">OWNER CONTROL</div>
        <h1>MoonShotForge Admin</h1>
        <p>Enter the private admin password stored in Vercel Environment Variables.</p>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={12} />
        {params.error ? <div className="error-box">{params.error === 'locked' ? 'Too many failed attempts. Wait 15 minutes.' : 'Password rejected.'}</div> : null}
        <button className="button primary" type="submit">Enter Control Room</button>
      </form>
    </main>
  );
}
