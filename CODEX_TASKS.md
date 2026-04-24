# Codex Maintenance Tasks

Use this checklist for safe iterative maintenance.

## Priority 0: Live safety
- [ ] Keep `ENABLE_LIVE_TRADING=false` unless explicitly approved.
- [ ] Run `npm run check:live` before restart/deploy.
- [ ] Verify `/health` and `/debug/status` after each change.

## Priority 1: Connectivity issues
- [ ] Fix Telegram connectivity (`getMe`, command reply failures).
- [ ] Fix RPC failures (`getBalance`, blockhash, confirm tx).
- [ ] Confirm proxy/runtime networking for Node fetch/web3.

## Priority 2: Trading reliability
- [ ] Debug failed swaps and classify root causes.
- [ ] Ensure failed transactions never mark trades complete.
- [ ] Keep retries bounded (no infinite loops).

## Priority 3: Profitability improvements
- [ ] Improve signal quality and noise filtering.
- [ ] Tune risk sizing based on real outcomes.
- [ ] Validate slippage and execution metrics daily.

## Priority 4: Observability
- [ ] Keep entry/exit/failure logs readable.
- [ ] Audit API responses for sensitive fields.
- [ ] Verify execution metrics and AI outcomes are persisted.

## Standard command set
```bash
npm run build
npm test
npm run check:live
npm run deploy:live
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/debug/status
```
