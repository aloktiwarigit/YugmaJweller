'use strict';

/* eslint-disable @typescript-eslint/explicit-function-return-type */

const { withSettingsGradle } = require('expo/config-plugins');

const DEFAULT_RN_GRADLE_PLUGIN_RESOLVER =
  "require.resolve('@react-native/gradle-plugin/package.json')";
const PNPM_SAFE_RN_GRADLE_PLUGIN_RESOLVER =
  "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })";

function normalizeReactNativeGradlePluginPath(contents) {
  return contents.replace(
    DEFAULT_RN_GRADLE_PLUGIN_RESOLVER,
    PNPM_SAFE_RN_GRADLE_PLUGIN_RESOLVER,
  );
}

module.exports = function withPnpmGradlePluginPaths(config) {
  return withSettingsGradle(config, (modConfig) => {
    modConfig.modResults.contents = normalizeReactNativeGradlePluginPath(
      modConfig.modResults.contents,
    );
    return modConfig;
  });
};

module.exports.normalizeReactNativeGradlePluginPath = normalizeReactNativeGradlePluginPath;
