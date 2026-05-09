const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force axios to use browser build
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;