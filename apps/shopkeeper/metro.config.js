// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
// When running from a git worktree the workspace root is
// .worktrees/<branch>; the main repo sits two levels higher and has
// a fully-hoisted node_modules that Metro needs for resolution.
const mainRepoRoot = path.resolve(workspaceRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(mainRepoRoot, 'node_modules'),
];
// NOTE: disableHierarchicalLookup intentionally omitted.
// pnpm stores peer deps as siblings inside .pnpm/<hash>/node_modules/; Metro
// needs hierarchical lookup enabled to walk up to those siblings. The explicit
// nodeModulesPaths above still controls which workspace roots are searched.

module.exports = config;
