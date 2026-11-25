// Dodatne postavke aplikacije. Nadograđuje app.json koji je napravio Expo
// (ikone, verzija i EAS projectId ostaju u app.json).
const fs = require('fs');

module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync('./google-services.json');
  return {
    ...config,
    name: 'NautiStaff Live',
    android: {
      ...(config.android || {}),
      package: 'hr.nautistaff.app',
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    },
    plugins: [
      ...(config.plugins || []),
      'expo-notifications',
      ['expo-location', { locationWhenInUsePermission: 'NautiStaff koristi lokaciju da vam pokaže ponude u blizini.' }],
    ],
  };
};
