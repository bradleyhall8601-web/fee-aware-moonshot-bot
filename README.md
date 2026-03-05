# fee-aware-moonshot-bot

Default mode is paper trading (`ENABLE_LIVE_TRADING=false`).

## Live Trading Safety

- Live mode is opt-in with `ENABLE_LIVE_TRADING=true`.
- Wallet can run in monitor-only mode with `WALLET_PUBKEY`, but live swaps require `WALLET_PRIVATE_KEY` or `WALLET_KEYPAIR_PATH`.
- `RPC_URL` is required for live mode.
- `DRY_RUN=true` in live mode will quote, build, sign, and simulate swaps but will not send transactions.
- The bot never logs private keys.

## Environment Setup

- Copy defaults once if needed: `cp .env.example .env`
- `.env` is not auto-created by runtime code; keep setup explicit via the command above.
- Keep `ENABLE_LIVE_TRADING=false` for safest paper-only operation.

Required keys in `.env` / `.env.example`:
- `ENABLE_LIVE_TRADING`, `DRY_RUN`
- Wallet identity: `WALLET_PRIVATE_KEY` or `WALLET_KEYPAIR_PATH` or `WALLET_PUBKEY`
- `RPC_URL`
- Trading and filters: `SLIPPAGE_BPS`, `MIN_LIQUIDITY_USD`, `MIN_VOLUME_M5_USD`, `MAX_VOLUME_M5_USD`, `MAX_FDV_USD`, `MAX_PAIR_AGE_HOURS`, `MAX_SEEN_PAIRS`, `REQUIRE_PRICE_UP_M5`, `MIN_TXNS_M5`, `MAX_TXNS_M5`, `MIN_BUYS_M5`, `MAX_BUYS_M5`, `MIN_SELLS_M5`, `MAX_SELLS_M5`, `MIN_LIQUIDITY_TO_FDV_RATIO`, `MAX_SELLS_TO_BUYS_RATIO`
- Risk caps: `MAX_CONCURRENT_POSITIONS`, `WALLET_SPEND_CAP_USD`, `SIZING_LADDER`
- Price fallback: `BIRDEYE_API_KEY`, `SOL_USD_FALLBACK`

## Runtime Notes

- Bot state persists at `./state.json` using atomic temp-file writes.
- Exits are evaluated before scanning new entries.
- At ~30% gain, positions take a 50% partial and keep a runner.
