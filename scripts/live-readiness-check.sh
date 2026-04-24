#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  TELEGRAM_BOT_TOKEN
  RPC_ENDPOINT
  MASTER_ENCRYPTION_KEY
)

missing=0
for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[ERROR] Missing required env: $v"
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  exit 1
fi

echo "[1/8] Node + deps"
node -v
npm install

echo "[2/8] Build"
npm run build

echo "[3/8] Telegram getMe"
curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); if(!j.ok){console.error('[ERROR] Telegram getMe failed', j); process.exit(1);} console.log('[OK] Telegram bot:', j.result.username);});"

echo "[4/8] RPC getBalance (Node/web3 runtime)"
node -e "const {ProxyAgent,setGlobalDispatcher}=require('undici'); const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY||process.env.https_proxy||process.env.http_proxy; if(proxy) setGlobalDispatcher(new ProxyAgent(proxy)); const {Connection, PublicKey}=require('@solana/web3.js'); const c=new Connection(process.env.RPC_ENDPOINT,{commitment:'confirmed',confirmTransactionInitialTimeout:60000}); c.getBalance(new PublicKey('11111111111111111111111111111111')).then(v=>{console.log('[OK] RPC balance:',v);}).catch(e=>{console.error('[ERROR] RPC check failed',e); process.exit(1);});"

echo "[5/8] Database integrity"
mkdir -p data
node -e "const Database=require('better-sqlite3'); const db=new Database('data/bot.db'); const row=db.prepare('PRAGMA integrity_check').get(); if(!row || row.integrity_check!=='ok'){console.error('[ERROR] SQLite integrity check failed:',row); process.exit(1);} console.log('[OK] SQLite integrity:',row.integrity_check); db.close();"

echo "[6/8] App boot smoke (20s)"
timeout 20s npx tsx src/index.ts >/tmp/bot-live-smoke.log 2>&1 || true
if rg -q "Bot Orchestrator started successfully" /tmp/bot-live-smoke.log; then
  echo "[OK] Orchestrator startup confirmed"
else
  echo "[ERROR] Orchestrator startup did not complete"
  tail -n 120 /tmp/bot-live-smoke.log
  exit 1
fi

echo "[7/8] API health + status"
curl -fsS "http://127.0.0.1:3000/health" >/dev/null
curl -fsS "http://127.0.0.1:3000/debug/status" >/dev/null
echo "[OK] API health and debug status reachable"

echo "[8/8] Wallet balance fetch capability check"
node -e "const te=require('./dist/trading-engine.js'); const t=te.default||te; if(!t || typeof t.getWalletBalance!=='function'){console.error('[ERROR] tradingEngine.getWalletBalance missing'); process.exit(1);} console.log('[OK] tradingEngine.getWalletBalance available');"

echo "[SUCCESS] Live readiness checks passed."
