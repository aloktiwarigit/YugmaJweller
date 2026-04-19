// Strip postinstall scripts that assume hoisted tooling which pnpm's strict
// isolation doesn't provide. These packages ship prebuilt JS — the postinstall
// only rebuilds dev tooling we don't ship (CI uses `expo export --platform web`).
function readPackage(pkg) {
  if (pkg.name === 'react-native-screens' && pkg.scripts?.postinstall) {
    delete pkg.scripts.postinstall;
  }
  if (pkg.name === 'cpu-features' && pkg.scripts?.install) {
    delete pkg.scripts.install;
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
