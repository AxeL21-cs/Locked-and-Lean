const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly worker on web. Android continues to use the
// native module, while this asset entry keeps the hosted OAuth/web export valid.
config.resolver.assetExts.push("wasm");

module.exports = config;
