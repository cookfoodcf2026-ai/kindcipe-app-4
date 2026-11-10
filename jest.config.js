module.exports = {
  preset: "jest-expo",
  testMatch: [
    "<rootDir>/lib/purchase.test.ts",
    "<rootDir>/lib/draftRecipes.test.ts",
    "<rootDir>/lib/aiFillSteps.test.ts",
    "<rootDir>/lib/shoppingBatch.test.ts",
    "<rootDir>/lib/shoppingPayload.test.ts",
    "<rootDir>/components/__tests__/PaywallModal.test.tsx",
    "<rootDir>/components/__tests__/settings.deleteAccount.test.tsx",
  ],
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
