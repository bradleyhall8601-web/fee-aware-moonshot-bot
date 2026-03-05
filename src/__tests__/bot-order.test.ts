import { MoonshotBot } from "../bot";
import { PaperTrader } from "../paper";
import { defaultState } from "../persistence";

describe("bot order", () => {
  it("manages positions before scanning for entries", async () => {
    const calls: string[] = [];
    const trader = new PaperTrader(defaultState());
    const bot = new MoonshotBot(trader, {
      persistState: async () => {
        calls.push("persist");
      },
      fetchPairs: async () => {
        calls.push("scan");
        return [];
      },
      filterPairs: (pairs) => {
        calls.push("filter");
        return pairs;
      }
    });

    const manageSpy = jest.spyOn(bot, "managePositionsTick").mockImplementation(async () => {
      calls.push("manage");
    });

    await bot.scanAndEnterTick();

    expect(calls[0]).toBe("manage");
    expect(calls).toContain("scan");

    manageSpy.mockRestore();
  });
});
