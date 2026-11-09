module.exports = {
  preset: "jest-expo",
  testMatch: [
    "<rootDir>/lib/purchase.test.ts",
    "<rootDir>/components/__tests__/PaywallModal.test.tsx",
    "<rootDir>/components/__tests__/settings.deleteAccount.test.tsx",
  ],
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
