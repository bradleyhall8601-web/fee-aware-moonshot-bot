const quoteGet = jest.fn();
const swapPost = jest.fn();

jest.mock("@jup-ag/api", () => ({
  createJupiterApiClient: () => ({
    quoteGet,
    swapPost
  })
}));

describe("executeSwapFromQuote dry-run", () => {
  it("does not broadcast and returns null", async () => {
    process.env.DRY_RUN = "true";
    jest.resetModules();

    const quote = {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "mint-1",
      inAmount: "1000",
      outAmount: "900",
      otherAmountThreshold: "850",
      swapMode: "ExactIn",
      slippageBps: 300,
      routePlan: [],
      priceImpactPct: "0.2"
    } as any;

    const { executeSwapFromQuote } = await import("../swapper");
    const web3 = require("@solana/web3.js");
    const payer = web3.Keypair.generate();
    const result = await executeSwapFromQuote(quote, payer, "https://api.mainnet-beta.solana.com", "https://quote-api.jup.ag/v6", 300);

    expect(result).toBeNull();
    expect(swapPost).not.toHaveBeenCalled();
  });
});
