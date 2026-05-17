// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function uniquePaths(paths) {
  return Array.from(new Set(paths));
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function resolvePackageNodeModules(packageName) {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [projectRoot] });
    let currentPath = path.dirname(packageJsonPath);
    while (path.basename(currentPath) !== 'node_modules') {
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        return null;
      }
      currentPath = parentPath;
    }
    return currentPath;
  } catch {
    return null;
  }
}

const appPackageJson = require('./package.json');
const appDependencyNames = Object.keys({
  ...appPackageJson.dependencies,
  ...appPackageJson.devDependencies,
});

const packageNodeModules = [
  'packages/auth-client/node_modules',
  'packages/compliance/node_modules',
  'packages/i18n/node_modules',
  'packages/money/node_modules',
  'packages/shared/node_modules',
  'packages/sync/node_modules',
  'packages/ui-mobile/node_modules',
  'packages/ui-tokens/node_modules',
]
  .map((relativePath) => path.resolve(workspaceRoot, relativePath))
  .filter((packageNodeModulesPath) => fs.existsSync(packageNodeModulesPath));
const pnpmVirtualStoreNodeModules = path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules');

// pnpm keeps transitive dependencies under each package's real store location.
// With hierarchical lookup disabled, Metro needs those real node_modules
// folders explicitly listed so dependencies like @tanstack/query-core and
// prop-types resolve during export.
const dependencyNodeModules = appDependencyNames
  .map(resolvePackageNodeModules)
  .filter(Boolean);
config.resolver.nodeModulesPaths = uniquePaths([
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  ...(fs.existsSync(pnpmVirtualStoreNodeModules) ? [pnpmVirtualStoreNodeModules] : []),
  ...packageNodeModules,
  ...dependencyNodeModules,
]);
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
