// Dodatne postavke aplikacije. Nadograđuje app.json koji je napravio Expo
// (ikone, broj verzije "version" i EAS projectId ostaju u app.json).
const fs = require('fs');

module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync('./google-services.json');
  const projectId = config.extra && config.extra.eas && config.extra.eas.projectId;
  return {
    ...config,
    name: 'NautiStaff Live',
    android: {
      ...(config.android || {}),
      package: 'hr.nautistaff.app',
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    },
    // AŽURIRANJE "PREKO ZRAKA": mobiteli preuzimaju nove verzije koda s Expo servera.
    // runtimeVersion = "version" iz app.json. Kad dodajemo nove dodatke ili dozvole,
    // povećamo "version" u app.json (npr. 1.0.0 -> 1.0.1) i napravimo novi APK.
    ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}` } } : {}),
    runtimeVersion: { policy: 'appVersion' },
    plugins: [
      ...(config.plugins || []),
      'expo-notifications',
      ['expo-location', { locationWhenInUsePermission: 'NautiStaff koristi lokaciju da vam pokaže ponude u blizini.' }],
    ],
  };
};
