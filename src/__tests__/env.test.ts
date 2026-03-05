describe("env boolean parsing", () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  it("parses True/TRUE/true as true for ENABLE_LIVE_TRADING and DRY_RUN", async () => {
    for (const value of ["True", "TRUE", "true"]) {
      process.env = {
        ...originalEnv,
        ENABLE_LIVE_TRADING: value,
        DRY_RUN: value
      };
      jest.resetModules();
      const mod = await import("../env");
      expect(mod.isLiveEnabled()).toBe(true);
      expect(mod.isDryRun()).toBe(true);
    }
  });
});
