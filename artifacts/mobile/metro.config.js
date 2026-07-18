const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;

// Find the workspace root (where pnpm-workspace.yaml exists)
function findWorkspaceRoot(startDir) {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return startDir;
}

const workspaceRoot = findWorkspaceRoot(projectRoot);

const config = getDefaultConfig(projectRoot);

// Configure for pnpm monorepo WITHOUT overwriting Expo defaults
// Add workspace root to existing watchFolders instead of replacing
const defaultWatchFolders = config.watchFolders || [];
config.watchFolders = [...defaultWatchFolders, workspaceRoot];

// Add workspace node_modules to existing nodeModulesPaths
const defaultNodeModulesPaths = config.resolver?.nodeModulesPaths || [];
config.resolver.nodeModulesPaths = [
  ...defaultNodeModulesPaths,
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
