module.exports = {
  testRunner: 'jest-circus/runner',
  testTimeout: 120000,
  testEnvironment: 'detox/runners/jest/testEnvironment',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
};
