// src/payments/paypal-handler.ts
// PayPal payment handling (manual approval flow)

import telemetryLogger from '../telemetry';

export interface PayPalPaymentRequest {
  userId: string;
  telegramId: string;
  amount: string;
  currency: string;
  paypalHandle: string;
  paymentLink: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: number;
}

class PayPalHandler {
  private pendingPayments = new Map<string, PayPalPaymentRequest>();
  private readonly PAYPAL_HANDLE = process.env.PAYPAL_ME_HANDLE || 'BradleyHall01';
  private readonly PRICE = process.env.SUBSCRIPTION_PRICE_DISPLAY || '$49.99/month';
  private readonly PRICE_AMOUNT = process.env.SUBSCRIPTION_PRICE_AMOUNT || '49.99';

  createPaymentRequest(userId: string, telegramId: string): PayPalPaymentRequest {
    const req: PayPalPaymentRequest = {
      userId,
      telegramId,
      amount: this.PRICE_AMOUNT,
      currency: 'USD',
      paypalHandle: this.PAYPAL_HANDLE,
      paymentLink: `https://paypal.me/${this.PAYPAL_HANDLE}/${this.PRICE_AMOUNT}`,
      createdAt: Date.now(),
      status: 'pending',
    };
    this.pendingPayments.set(userId, req);
    telemetryLogger.info(`PayPal payment request created for user ${userId}`, 'paypal');
    return req;
  }

  getPaymentInstructions(userId: string): string {
    const req = this.pendingPayments.get(userId) || this.createPaymentRequest(userId, '');
    return `💳 *PayPal Payment Instructions*

Amount: ${this.PRICE}
PayPal: paypal.me/${this.PAYPAL_HANDLE}

1. Send ${this.PRICE_AMOUNT} USD to the link above
2. Include your Telegram username in the note
3. Send proof of payment to the bot
4. Wait for admin approval (usually within 24h)

Payment Link: ${req.paymentLink}`;
  }

  approvePayment(userId: string, approvedBy: string): boolean {
    const req = this.pendingPayments.get(userId);
    if (!req) return false;
    req.status = 'approved';
    req.approvedBy = approvedBy;
    req.approvedAt = Date.now();
    telemetryLogger.info(`PayPal payment approved for user ${userId} by ${approvedBy}`, 'paypal');
    return true;
  }

  rejectPayment(userId: string, rejectedBy: string): boolean {
    const req = this.pendingPayments.get(userId);
    if (!req) return false;
    req.status = 'rejected';
    req.approvedBy = rejectedBy;
    telemetryLogger.info(`PayPal payment rejected for user ${userId} by ${rejectedBy}`, 'paypal');
    return true;
  }

  getPendingPayments(): PayPalPaymentRequest[] {
    return Array.from(this.pendingPayments.values()).filter(p => p.status === 'pending');
  }

  getPayment(userId: string): PayPalPaymentRequest | null {
    return this.pendingPayments.get(userId) || null;
  }
}

export default new PayPalHandler();
