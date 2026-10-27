module.exports = [
  ...require("eslint-config-expo/flat"),
  {
    files: ["e2e/**/*.test.js"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        beforeEach: "readonly",
        device: "readonly",
        waitFor: "readonly",
        element: "readonly",
        by: "readonly",
        expect: "readonly",
      },
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["app/styles/typography.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='fontFamily']",
          message: "Use typography tokens from app/styles/typography.ts. Do not set fontFamily directly.",
        },
      ],
    },
  },
];
