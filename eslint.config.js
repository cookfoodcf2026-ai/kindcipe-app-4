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
];
