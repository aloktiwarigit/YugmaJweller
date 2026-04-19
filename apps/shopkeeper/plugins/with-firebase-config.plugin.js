'use strict';
// Reserved for post-SOW multi-tenant Firebase project injection.
// For MVP, @react-native-firebase/app + @react-native-firebase/auth config plugins
// handle the single goldsmith-dev project wiring. When anchor SOW signs, extend this
// to inject per-tenant googleServicesFile paths from tenant metadata at build time.
module.exports = function withFirebaseConfig(config) {
  return config;
};
