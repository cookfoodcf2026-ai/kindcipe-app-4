module.exports = {
  preset: "detox",
  testRunner: "jest-circus/runner",
  testTimeout: 120000,
  reporters: ["detox/runners/jest/streamlineReporter"],
  setupFilesAfterEnv: ["./init.js"],
};
