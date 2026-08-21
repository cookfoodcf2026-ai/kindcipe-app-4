const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow connections from real devices on local network
config.server = {
  ...config.server,
  hostname: '0.0.0.0',
};

// Fix: Set up @ alias for absolute path resolution
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  '@': path.resolve(__dirname),
};

// Disable watchman to prevent path encoding issues
config.resolver.useWatchman = false;

module.exports = config;
