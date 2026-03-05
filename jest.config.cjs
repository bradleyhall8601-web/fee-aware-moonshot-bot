module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/__tests__/bot-order.test.ts",
    "**/__tests__/risk.test.ts",
    "**/__tests__/persistence.test.ts",
    "**/__tests__/paper.test.ts",
    "**/__tests__/swapper.test.ts",
    "**/__tests__/env.test.ts"
  ]
};
