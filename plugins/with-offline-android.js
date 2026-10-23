const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');
module.exports = (config) => {
  config = withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    const definitions = [
      { 'android:name': 'android.permission.BLUETOOTH', 'android:maxSdkVersion': '30' },
      { 'android:name': 'android.permission.BLUETOOTH_ADMIN', 'android:maxSdkVersion': '30' },
      { 'android:name': 'android.permission.ACCESS_FINE_LOCATION', 'android:maxSdkVersion': '30' },
      {
        'android:name': 'android.permission.BLUETOOTH_SCAN',
        'android:usesPermissionFlags': 'neverForLocation',
      },
      { 'android:name': 'android.permission.BLUETOOTH_CONNECT' },
      { 'android:name': 'android.permission.BLUETOOTH_ADVERTISE' },
    ];
    m['uses-permission'] = [
      ...(m['uses-permission'] || []).filter(
        (p) => !definitions.some((d) => d['android:name'] === p.$['android:name']),
      ),
      ...definitions.map(($) => ({ $ })),
    ];
    m['uses-feature'] = [
      { $: { 'android:name': 'android.hardware.bluetooth', 'android:required': 'false' } },
      { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
    ];
    m.application[0].$['android:allowBackup'] = 'false';
    m.application[0].$['android:usesCleartextTraffic'] = 'false';
    return c;
  });
  return withAppBuildGradle(config, (c) => {
    // Preview APKs use Android's debug key. A private release key stays outside source control.
    const marker = '// OPEN_CODENAMES_SIGNING';
    if (!c.modResults.contents.includes(marker)) {
      c.modResults.contents += `
${marker}
def ocKey = System.getenv('OC_KEYSTORE')
if (ocKey) {
    android.signingConfigs.create('ocRelease') {
        storeFile file(ocKey)
        storePassword System.getenv('OC_STORE_PASSWORD')
        keyAlias System.getenv('OC_KEY_ALIAS')
        keyPassword System.getenv('OC_KEY_PASSWORD')
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.ocRelease
}
`;
    }
    return c;
  });
};
