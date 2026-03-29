# Telegram User Registration & Onboarding Guide

Complete guide for the enhanced Telegram registration and wallet setup flow.

## Registration Flow Overview

When a user joins the Telegram bot, they go through these steps:

```
1. User sends /start → Bot welcomes them
2. User sends /register → Registration begins
3. Username entry → Bot stores username
4. Wallet choice → Import or Generate
5. Wallet setup → User provides/receives wallet
6. Confirmation → Account created
7. Ready to trade → User is onboarded
```

## For Bot Users (Telegram)

### Starting Registration

1. Open Telegram and search for `@MoonShotForge_bot`
2. Send `/start` to see welcome message
3. Click "Register Now" or send `/register`

### Step 1: Choose Username

```
Bot: "Step 1: What's your username? (e.g., trader_pro)"
You: trader_pro
```

Requirements:
- 3-30 characters
- Only letters, numbers, dashes, underscores
- Must be unique

### Step 2: Choose Wallet Method

Bot shows two options:

```
📥 Import Existing Wallet
   Use if you have a Solana wallet already

✨ Generate New Wallet
   Create a brand new Solana wallet
```

#### If Importing Wallet:

1. Get your private key from Phantom/Solflare
2. Send to bot (first time only, never again!)
3. Bot validates and stores securely
4. Confirm to complete

⚠️ **Security:**
- Bot only stores key locally
- Key is encrypted in database
- Never re-send again

#### If Generating Wallet:

1. Bot generates new Solana wallet
2. Shows you the public address (safe to share)
3. Private key stored securely
4. Ready to use immediately

### Step 3: Confirmation

```
Bot shows:
- Your username
- Your wallet address
- Option to confirm

Click "✅ Confirm & Complete"
```

### Registration Complete! 🎉

```
Bot sends:
✅ Account Created
Username: trader_pro
Wallet: 5N7eT...d3Xz

You can now:
📊 Monitor portfolio
⚡ View trading signals
⚙️ Configure settings
📜 Check history

Use /help for all commands
```

## For Bot Admins (Python/Node)

### User Registration Data

Stored in database:

```
User {
  id: "123",
  username: "trader_pro",
  telegramId: "987654321",
  walletAddress: "5N7eT...",
  privateKey: "encrypted_key",
  createdAt: "2026-03-28T18:00:00Z",
  settings: {
    maxPosition: 100,
    riskLevel: "medium",
    tradingEnabled: false
  },
  trades: [...],
  metadata: {...}
}
```

### Managing Users

Check all registered users:

```python
import database
users = database.getAllActiveUsers()
for user in users:
    print(f"{user.username} - {user.walletAddress[:8]}...")
```

Get specific user:

```python
user = userManager.getUserByUsername("trader_pro")
print(user.walletAddress)
user.settings.tradingEnabled = True
```

Disable user:

```python
userManager.disableUser(userId)
# User can still see history but cannot trade
```

## Bot Commands for Users

```
/start              - Welcome & register
/register           - Start registration
/status             - Portfolio status
/config             - View/change settings
/trades             - Trading history
/help               - Available commands
/stop_trading       - Pause trading
/start_trading      - Resume trading
```

## Error Handling

### Common Registration Errors

**"Username must be 3-30 characters"**
- Too short or too long
- Fix: Choose username between 3-30 chars

**"Username can only contain letters, numbers, dashes, and underscores"**
- Invalid characters used
- Fix: Remove special characters like @, #, !

**"Username already taken"**
- Someone else has that username
- Fix: Choose different username

**"Invalid private key format"**
- Private key not in valid format
- Fix: Export from Phantom/Solflare as base58

**"Registration session expired"**
- Took too long (5+ minutes)
- Fix: Start over with /register

### Security Best Practices

✅ **DO:**
- Send keys in private chat (not groups)
- Use fresh wallet with funds
- Enable 2FA on Telegram
- Verify bot username @MoonShotForge_bot

❌ **DON'T:**
- Screenshot your wallet address
- Share private key with anyone
- Use same key for multiple bots
- Save key in notes/Discord

## Multi-Device Support

Same account on multiple phones:

1. Each device sends `/start` → Gets new Telegram ID
2. Username must match exactly
3. Access same wallet from all devices
4. Trades visible on all devices in real-time

## Account Recovery

If you lose access:

1. Contact admin via Telegram
2. Provide original Telegram ID
3. Verify wallet address
4. Reset access

Note: We cannot recover private keys - they're encrypted

## Registration Success Indicators

You've completed registration when:

- ✅ Telegram bot says "Registration Complete"
- ✅ You can see `/status` command
- ✅ Your wallet appears in bot dashboard
- ✅ You receive welcome message
- ✅ First trading signal arrives (if enabled)

## Next Steps After Registration

1. **Fund your wallet**
   - Send SOL to your wallet address
   - Wait for confirmation

2. **Configure settings**
   - Send `/config`
   - Set max position size
   - Choose risk level

3. **Monitor signals**
   - Receive trading signals in Telegram
   - Check portfolio with `/status`
   - View history with `/trades`

4. **Enable trading**
   - Send `/start_trading` to begin
   - Bot will auto-execute trades
   - Monitor with `/status`

---

**Status: ✅ Registration System Active**

Users can now register and start trading within minutes!
