// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
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

// Exclude .claude/worktrees and other non-source directories from Metro's file
// watcher so expo-router typed-routes generation does not pick up worktree
// TypeScript files and pollute .expo/types/router.d.ts with spurious routes.
config.resolver.blockList = [
  new RegExp(path.resolve(workspaceRoot, '.claude', 'worktrees').replace(/\\/g, '\\\\') + '.*'),
];

const appPackageJson = require('./package.json');
const appDependencyNames = Object.keys({
  ...appPackageJson.dependencies,
  ...appPackageJson.devDependencies,
});

const packageNodeModules = [
  'packages/auth-client/node_modules',
  'packages/customer-shared/node_modules',
  'packages/i18n/node_modules',
  'packages/shared/node_modules',
  'packages/ui-mobile/node_modules',
  'packages/ui-tokens/node_modules',
]
  .map((relativePath) => path.resolve(workspaceRoot, relativePath))
  .filter((packageNodeModulesPath) => fs.existsSync(packageNodeModulesPath));
const pnpmVirtualStoreNodeModules = path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules');

// pnpm keeps transitive dependencies under each package's real store location.
// Disable hierarchical lookup so React is resolved once from the app root, and
// explicitly list dependency node_modules folders for package transitives.
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

module.exports = withNativeWind(config, {
  input: './global.css',
  // NativeWind 4.0.x splits cliCommand on spaces before spawning it.
  // Resolve Tailwind through Node's module loader so Windows paths with spaces
  // in the workspace do not break Metro or Android release bundling.
  cliCommand: 'node -e "require(\'tailwindcss/lib/cli\')" -- tailwindcss',
});
