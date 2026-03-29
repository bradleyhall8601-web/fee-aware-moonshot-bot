# Telegram Bot Testing Guide

## Prerequisites
- Get Telegram bot token from @BotFather
- Set `TELEGRAM_BOT_TOKEN` in .env or Replit Secrets
- Run: `npm run dev`

---

## Test Case 1: Start Command
**Purpose:** Verify bot responds to initial start

```
1. Open Telegram
2. Find your bot (search by username)
3. Send: /start
4. Expected: Welcome message with "Register Now" and "Help" buttons
5. Success: Message appears within 2 seconds
```

**Pass Criteria:**
- ✅ Bot responds
- ✅ Welcome message appears
- ✅ Buttons are clickable
- ✅ No error messages

---

## Test Case 2: Registration - Generate Wallet

**Purpose:** Test generating a new wallet for trading

```
1. Send: /register
2. Expected: "Welcome to Registration" message asking for username
3. Send: trader_test123
4. Expected: Wallet choice buttons (Import / Generate)
5. Click: ✨ Generate New Wallet
6. Expected: New wallet address shown with confirmation button
7. Click: ✅ Confirm & Complete Setup
8. Expected: Registration complete message with success emoji
9. Send: /status
10. Expected: Shows your new wallet and paper mode status
11. Success: All steps complete within 10 seconds total
```

**Pass Criteria:**
- ✅ Username validated
- ✅ Wallet generated
- ✅ Wallet address displayed
- ✅ User created in database
- ✅ /status shows new user
- ✅ Paper mode enabled by default

---

## Test Case 3: Registration - Import Wallet

**Purpose:** Test importing an existing wallet

```
Prerequisites: Have a valid Solana wallet's base58 private key

1. Send: /register
2. Send username: wallet_importer
3. Click: 📥 Import Existing Wallet
4. Expected: Prompt for private key
5. Send: <your-valid-base58-private-key>
6. Expected: Wallet imported successfully message
7. Click: ✅ Confirm & Complete
8. Expected: Registration complete
9. Send: /status
10. Expected: Shows imported wallet address
11. Success: Wallet imported and ready
```

**Pass Criteria:**
- ✅ Private key validated (base58 format)
- ✅ Public key derived correctly
- ✅ User created with imported wallet
- ✅ /status reflects imported wallet

---

## Test Case 4: Paper/Live Mode Switching

**Purpose:** Test switching between paper and live trading modes

```
1. Register a user (Test Case 2 or 3)
2. Send: /status
3. Expected: Shows "🔴 PAPER MODE" (default)
4. Send: /start_trading
5. Expected: Warning message about live trading with real funds
6. Send: /status
7. Expected: Shows "🟢 LIVE TRADING ENABLED"
8. Send: /stop
9. Expected: Returns to paper mode message
10. Send: /status
11. Expected: Shows "🔴 PAPER MODE" again
12. Success: Toggling works smoothly
```

**Pass Criteria:**
- ✅ Paper mode is default
- ✅ Can enable live trading
- ✅ /status reflects current mode
- ✅ Can disable back to paper mode
- ✅ Database persists mode setting

---

## Test Case 5: Configuration View

**Purpose:** Verify user can view trading configuration

```
1. After registering: Send /config
2. Expected: Shows all trading parameters
   - Min Liquidity
   - Pool Age limits
   - Transaction thresholds
   - Profit/Stop-Loss settings
3. Success: All values display correctly
```

**Pass Criteria:**
- ✅ Config loads
- ✅ All parameters shown
- ✅ Default values are correct
- ✅ No errors displayed

---

## Test Case 6: Help Command

**Purpose:** Verify help system

```
1. Send: /help
2. Expected: Complete list of available commands with descriptions
   - /register - Register wallet
   - /status - View status
   - /config - View settings
   - /trades - View trades
   - /start_trading - Enable live
   - /stop - Disable live
   - /help - This help
3. Success: All commands documented
```

**Pass Criteria:**
- ✅ Help message appears
- ✅ All commands listed
- ✅ Descriptions clear

---

## Test Case 7: Error Handling

**Purpose:** Verify error messages are helpful

```
1. Send: /start_trading
   (Before registering)
2. Expected: "Please register first using /register"
3. Send: /stop
   (Before registering)
4. Expected: "Please register first using /register"
5. Send: /status
   (Before registering)
6. Expected: "Please register first using /register"
7. Success: All errors are clear and actionable
```

**Pass Criteria:**
- ✅ No empty/generic errors
- ✅ Messages tell user what to do
- ✅ No crash or hang

---

## Test Case 8: Button Callbacks

**Purpose:** Verify inline buttons work properly

```
1. Send: /start
2. Click: "Register Now" button
3. Expected: Registration starts normally
   (Should be same as /register command)
4. Send: /start
5. Click: "Help" button
6. Expected: Help message appears
7. Success: All buttons respond quickly
```

**Pass Criteria:**
- ✅ Buttons respond within 1 second
- ✅ No "loading" delays
- ✅ Correct action triggered
- ✅ User gets feedback

---

## Test Case 9: Database Persistence

**Purpose:** Verify user data persists

```
1. Register: username=test_persist
2. Generate wallet: note the address
3. Send: /status (note the data)
4. Send: /stop
5. Stop bot: Ctrl+C
6. Wait 5 seconds
7. Restart bot: npm run dev
8. Send: /status
9. Expected: Same user, same wallet, same settings
10. Success: Data persisted across restarts
```

**Pass Criteria:**
- ✅ User found after restart
- ✅ Wallet address same
- ✅ Settings retained
- ✅ No data loss

---

## Test Case 10: Multiple Users

**Purpose:** Verify multi-user support works

```
1. User A: /register → username: alice, generate wallet
2. User B (different Telegram account): /register → username: bob, generate wallet
3. User A: /status
4. Expected: Only shows Alice's data
5. User B: /status
6. Expected: Only shows Bob's data
7. User A: /start_trading → switch to live
8. User B: /status
9. Expected: Bob still in paper mode (Alice's change doesn't affect bob)
10. Success: Fully isolated per-user state
```

**Pass Criteria:**
- ✅ Users are separate
- ✅ Each sees only their data
- ✅ Settings are per-user
- ✅ No cross-user interference

---

## Quick Test Sequence (5 minutes)

Run this sequence for quick verification:

```
1. /start → ✅ Welcome appears
2. Click "Register Now" → ✅ Username prompt
3. Enter: test123 → ✅ Wallet choice
4. Click "Generate" → ✅ Wallet shown
5. Click "Confirm" → ✅ Success message
6. /status → ✅ Shows user data
7. /start_trading → ✅ Warning shown
8. /status → ✅ Shows live mode
9. /stop → ✅ Back to paper
10. /status → ✅ Shows paper mode
```

**Pass Rate**: 10/10 = ✅ FULLY OPERATIONAL

---

## Health Check Endpoint

```bash
# Verify API is responding
curl http://localhost:3000/health

# Expected output:
{
  "ok": true,
  "mode": "multi-user-production",
  "timestamp": "2026-03-29T...",
  "bot": {
    "activeUsers": 1,
    "activeTrades": 0,
    "totalProfit": 0
  }
}
```

---

## Logs Location

Find bot logs here:
- `logs/bot-YYYY-MM-DD.log` - Daily bot logs
- Console output (if running with `npm run dev`)

Check logs for any error messages:

```bash
tail -f logs/bot-*.log
```

---

## Success Indicators

- ✅ All tests pass without errors
- ✅ Response times under 2 seconds
- ✅ No crash or hang states
- ✅ Database saves persist
- ✅ User data is isolated
- ✅ Callbacks fire immediately
- ✅ Error messages are helpful
- ✅ Paper mode is default
- ✅ All commands work

---

## If Tests Fail

1. **Check logs**: `tail -f logs/bot-*.log`
2. **Verify token**: `echo $TELEGRAM_BOT_TOKEN`
3. **Check bot is running**: `npm run dev`
4. **Rebuild**: `npm run build`
5. **Clear cache**: `rm -rf dist node_modules` then `npm install`
6. **Check database**: `ls -la data/bot.db`

---

**TESTING STATUS: READY** ✅

All test cases are designed to be quick and verify key functionality.
