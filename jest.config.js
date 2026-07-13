module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/fixtures.ts",
    "!src/**/*.d.ts",
  ],
};
