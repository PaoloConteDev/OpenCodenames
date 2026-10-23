module.exports = {
  expo: {
    name: 'Open Codenames',
    slug: 'open-codenames',
    version: require('./package.json').version,
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    icon: './assets/icon.png',
    android: {
      package: 'org.opencodenames.app',
      versionCode: 19,
      allowBackup: false,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#101021' },
      permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
      blockedPermissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    updates: { enabled: false },
    plugins: [
      './plugins/with-offline-android',
      'expo-font',
      [
        'expo-camera',
        { cameraPermission: 'Scansiona il QR della partita locale.', recordAudioAndroid: false },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: '36.0.0',
          },
        },
      ],
    ],
  },
};
