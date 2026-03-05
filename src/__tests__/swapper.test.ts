import { executeLiveSwap } from "../swapper";

describe("executeLiveSwap dry-run", () => {
  it("does not send transaction and returns dry-run signature", async () => {
    const sendRawTransaction = jest.fn();

    const mockCtx = {
      wallet: {
        publicKey: {
          toBase58: () => "WalletPubkey11111111111111111111111111111111"
        }
      },
      connection: {
        simulateTransaction: jest.fn().mockResolvedValue({ value: { err: null } }),
        sendRawTransaction,
        getLatestBlockhash: jest.fn(),
        confirmTransaction: jest.fn()
      },
      jupiterApi: {
        quoteGet: jest.fn().mockResolvedValue({
          inAmount: "1000",
          outAmount: "900",
          priceImpactPct: "0.2"
        }),
        swapPost: jest.fn().mockResolvedValue({
          swapTransaction: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAED"
        })
      }
    } as any;

    const deserializeSpy = jest
      .spyOn(require("@solana/web3.js").VersionedTransaction, "deserialize")
      .mockReturnValue({
        sign: jest.fn(),
        serialize: jest.fn().mockReturnValue(Buffer.from("deadbeef", "hex"))
      });

    const result = await executeLiveSwap(
      mockCtx,
      {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "mint-1",
        amount: "1000"
      },
      {
        dryRun: true,
        maxPriceImpactPct: 5,
        slippageBps: 300,
        feeUsdEstimate: 0.1
      }
    );

    expect(result.dryRun).toBe(true);
    expect(result.txSig.startsWith("DRYRUN_")).toBe(true);
    expect(sendRawTransaction).not.toHaveBeenCalled();

    deserializeSpy.mockRestore();
  });
});
