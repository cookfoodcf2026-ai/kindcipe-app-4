const detox = require("detox");
const config = require("../detox.config");

beforeAll(async () => {
  await detox.init(config, { launchApp: false });
});

afterAll(async () => {
  await detox.cleanup();
});

beforeEach(async () => {
  await device.reloadReactNative();
});
