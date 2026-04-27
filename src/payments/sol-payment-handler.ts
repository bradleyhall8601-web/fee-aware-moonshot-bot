// src/payments/sol-payment-handler.ts
// SOL payment handler for subscriptions

import solPayout from '../sol-payout';
import accessManager from '../access/access-manager';
import telemetryLogger from '../telemetry';

class SolPaymentHandler {
  async initiatePayment(userId: string, telegramId: string): Promise<string> {
    try {
      const req = await solPayout.createPaymentRequest(userId, telegramId);
      const solAmount = req.solAmount?.toFixed(4) || '?';
      const ownerWallet = req.ownerWallet;
      const expiresIn = Math.round((req.expiresAt - Date.now()) / 60000);

      return `⚡ *SOL Payment Instructions*

Amount: ~${solAmount} SOL (~$${req.expectedUsd})
Send to: \`${ownerWallet}\`

⏰ Expires in: ${expiresIn} minutes
✅ Payment is automatically detected

After sending, use /checkpayment to verify.`;
    } catch (err) {
      return `❌ SOL payment unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  async checkPayment(userId: string): Promise<{ confirmed: boolean; message: string }> {
    const req = solPayout.getPendingPayment(userId);
    if (!req) {
      return { confirmed: false, message: 'No pending payment found. Use /pay to start.' };
    }

    if (req.status === 'expired') {
      return { confirmed: false, message: 'Payment expired. Please start a new payment with /pay.' };
    }

    if (req.status === 'confirmed') {
      accessManager.grantAccess(userId, 'sol_payment', 30);
      solPayout.clearPayment(userId);
      return { confirmed: true, message: '✅ Payment confirmed! Your subscription is now active for 30 days.' };
    }

    const confirmed = await solPayout.pollForPayment(userId);
    if (confirmed) {
      accessManager.grantAccess(userId, 'sol_payment', 30);
      solPayout.clearPayment(userId);
      return { confirmed: true, message: '✅ Payment confirmed! Your subscription is now active for 30 days.' };
    }

    const remaining = Math.round((req.expiresAt - Date.now()) / 60000);
    return {
      confirmed: false,
      message: `⏳ Payment not yet detected. ${remaining} minutes remaining.\nMake sure you sent the correct amount to the correct wallet.`,
    };
  }
}

export default new SolPaymentHandler();
