const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Sentry's Expo config wrapper — enables the Sentry Metro serializer so JS
// source maps are generated and uploaded to Sentry (needs SENTRY_AUTH_TOKEN).
const config = getSentryExpoConfig(__dirname);

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

module.exports = config;
