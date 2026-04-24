import axios from 'axios';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import telemetryLogger from './telemetry';

interface SwapParams {
  owner: Keypair;
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}

interface SwapResult {
  signature: string;
  outputAmount: number;
}

class JupiterExecutor {
  private quoteApi = process.env.JUPITER_QUOTE_URL || 'https://quote-api.jup.ag/v6';
  private connection = new Connection(process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com', {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  private async withRetry<T>(opName: string, fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;

    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        telemetryLogger.error(`JUPITER_${opName}_FAIL attempt ${attempt}/${maxAttempts}: ${msg}`, 'jupiter-executor', err);
        if (attempt >= maxAttempts) break;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }

    throw new Error(`JUPITER_${opName}_UNAVAILABLE: ${String(lastErr)}`);
  }

  async swapExactIn(params: SwapParams): Promise<SwapResult> {
    return this.withRetry('SWAP_FLOW', async () => {
      const quote = await axios.get(`${this.quoteApi}/quote`, {
        params: {
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: Math.floor(params.amount),
          slippageBps: params.slippageBps,
        },
        timeout: 15000,
      });

      const quoteResponse = quote.data;
      if (!quoteResponse?.outAmount) {
        throw new Error('No Jupiter route returned');
      }

      const swapResponse = await axios.post(
        `${this.quoteApi}/swap`,
        {
          quoteResponse,
          userPublicKey: params.owner.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
        },
        { timeout: 20000 }
      );

      const swapTxBase64 = swapResponse.data?.swapTransaction;
      if (!swapTxBase64) {
        throw new Error('Swap transaction not returned by Jupiter');
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'));
      tx.sign([params.owner]);

      const signature = await this.withRetry(
        'SEND_TX',
        () => this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 }),
        3
      );

      const confirmation = await this.withRetry(
        'CONFIRM_TX',
        () => this.connection.confirmTransaction(signature, 'confirmed'),
        3
      );
      if (confirmation.value.err) {
        throw new Error(`On-chain confirmation failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return { signature, outputAmount: Number(quoteResponse.outAmount) };
    });
  }
}

export default new JupiterExecutor();
