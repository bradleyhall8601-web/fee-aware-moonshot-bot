# User Registration Flow

## How Users Register

1. User messages the Telegram bot
2. Bot sends `/start` welcome message
3. User clicks "Register Now" or sends `/register`
4. Registration flow begins:
   - Enter username (3-30 chars, alphanumeric)
   - Choose wallet: Import existing or Generate new
   - If import: paste base58 private key
   - If generate: bot creates new keypair, shows public address
   - Confirm to complete registration

## Access Levels

| Status | Description | Access |
|--------|-------------|--------|
| `owner` | Bot owner | Full access, never charged |
| `dev` | Developer | Full access, never charged |
| `active` | Paid subscriber | Full access |
| `granted` | Admin-granted | Full access |
| `pending` | Awaiting approval | Limited |
| `unpaid` | No subscription | No trading |
| `expired` | Subscription expired | No trading |
| `revoked` | Access removed | No access |

## Subscription Flow

1. User sends `/join`
2. Bot shows payment options (PayPal or SOL)
3. **PayPal**: User pays, sends proof, admin approves with `/approve <userId>`
4. **SOL**: Bot generates payment request, auto-detects payment on-chain
5. On approval: access status set to `active`, expiry set to 30 days

## Admin Commands

```
/approve <userId>  — Approve payment, grant 30-day access
/deny <userId>     — Reject payment
/grant <userId> [days] — Grant access manually
/revoke <userId>   — Revoke access
/users             — List all users with status
```

## Owner Commands

The owner (set via `OWNER_TELEGRAM_ID`) has permanent access and can use all admin commands plus:
- `/kill` — Emergency disable live trading
- `/resume` — Resume bot
- `/ai <question>` — Boss AI natural language commands
