// Default Expo configuration. The former "ws" shim and the global
// unstable_conditionNames override were only needed by the web build; on iOS and
// Android socket.io-client resolves its React Native / browser build natively.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
