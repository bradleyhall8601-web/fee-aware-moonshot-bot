const quoteGet = jest.fn();
const swapPost = jest.fn();
const simulateTransaction = jest.fn();
const sendRawTransaction = jest.fn();

jest.mock("@jup-ag/api", () => ({
  createJupiterApiClient: () => ({
    quoteGet,
    swapPost
  })
}));

jest.mock("../wallet", () => ({
  getWalletKeypair: () => ({
    publicKey: { toBase58: () => "WalletPubkey11111111111111111111111111111111" }
  })
}));

jest.mock("../rpc", () => ({
  getConnection: () => ({
    simulateTransaction,
    sendRawTransaction,
    getLatestBlockhash: jest.fn(),
    confirmTransaction: jest.fn()
  })
}));

describe("executeSwap dry-run", () => {
  it("does not send tx and returns fake dry-run signature", async () => {
    process.env.DRY_RUN = "true";
    jest.resetModules();

    quoteGet.mockResolvedValue({
      inAmount: "1000",
      outAmount: "900",
      priceImpactPct: "0.2"
    });
    swapPost.mockResolvedValue({
      swapTransaction: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAED"
    });
    simulateTransaction.mockResolvedValue({ value: { err: null } });

    const web3 = require("@solana/web3.js");
    const deserializeSpy = jest.spyOn(web3.VersionedTransaction, "deserialize").mockReturnValue({
      sign: jest.fn(),
      serialize: jest.fn(() => Buffer.from("deadbeef", "hex"))
    });

    const { executeSwap } = await import("../swapper");
    const result = await executeSwap(
      "So11111111111111111111111111111111111111112",
      "mint-1",
      1000,
      300
    );

    expect(result.signature.startsWith("DRYRUN_")).toBe(true);
    expect(sendRawTransaction).not.toHaveBeenCalled();

    deserializeSpy.mockRestore();
  });
});
