// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup is intentionally enabled (default) so Metro can
// follow each pnpm package up to its own .pnpm/<hash>/node_modules and
// resolve transitive deps that aren't hoisted to the app root —
// expo-router's @react-navigation/native-stack and @react-navigation/
// bottom-tabs (and its expo-linking peer) live under expo-router's
// virtual store, not under apps/customer-mobile/node_modules. Disabling
// hierarchical lookup wedged a clean-bundle on those transitives.

module.exports = withNativeWind(config, { input: './global.css' });
