const baseConfig = require('./app.json');

const officialExpoOwner = 'delacap';
const officialEasProjectId = 'bda73f23-ea7a-4a55-8ec5-bebdf021ac65';
const officialBundleIdentifier = 'app.tenos.als';
const officialAndroidPackage = 'app.tenos.als';
const healthConnectReadPermissions = [
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BODY_FAT',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_BODY_TEMPERATURE',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_NUTRITION',
  'android.permission.health.READ_HYDRATION',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_RESPIRATORY_RATE',
  'android.permission.health.READ_FLOORS_CLIMBED',
  'android.permission.health.READ_SPEED',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
];

function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendPlugin(plugins, plugin) {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  if (plugins.some((existing) => (Array.isArray(existing) ? existing[0] : existing) === name)) {
    return plugins;
  }
  return [...plugins, plugin];
}

module.exports = () => {
  const config = clone(baseConfig.expo);

  const expoOwner = optionalEnv('TENOS_EXPO_OWNER') || officialExpoOwner;
  const easProjectId = optionalEnv('TENOS_EAS_PROJECT_ID') || officialEasProjectId;
  const updatesUrl = optionalEnv('TENOS_UPDATES_URL') || (easProjectId ? `https://u.expo.dev/${easProjectId}` : undefined);
  const appleTeamId = optionalEnv('TENOS_APPLE_TEAM_ID');

  config.owner = expoOwner;

  config.ios = {
    ...config.ios,
    bundleIdentifier: optionalEnv('TENOS_IOS_BUNDLE_IDENTIFIER') || officialBundleIdentifier,
    entitlements: {
      ...(config.ios?.entitlements || {}),
      'com.apple.developer.usernotifications.time-sensitive': true,
    },
  };

  if (appleTeamId) {
    config.ios.appleTeamId = appleTeamId;
  } else {
    delete config.ios.appleTeamId;
  }

  config.android = {
    ...config.android,
    package: optionalEnv('TENOS_ANDROID_PACKAGE') || officialAndroidPackage,
    permissions: Array.from(new Set([
      ...(config.android?.permissions || []),
      ...healthConnectReadPermissions,
    ])),
  };

  config.plugins = appendPlugin(config.plugins || [], [
    '@kingstinct/react-native-healthkit',
    {
      NSHealthShareUsageDescription: 'TENOS can read selected health data, including measurements and medications you approve, and import it into your encrypted patient record.',
      NSHealthUpdateUsageDescription: 'TENOS does not write health data to Apple Health. This permission description is included because TENOS uses HealthKit to import approved health data.',
      background: false,
    },
  ]);
  config.plugins = appendPlugin(config.plugins, 'expo-health-connect');
  config.plugins = appendPlugin(config.plugins, [
    'expo-build-properties',
    {
      android: {
        minSdkVersion: 26,
        enableProguardInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    },
  ]);

  if (updatesUrl) {
    config.updates = {
      ...(config.updates || {}),
      enabled: true,
      url: updatesUrl,
    };
  } else {
    config.updates = {
      ...(config.updates || {}),
      enabled: false,
    };
    delete config.updates.url;
  }

  config.extra = {
    ...(config.extra || {}),
    router: config.extra?.router || {},
  };

  config.extra.eas = { projectId: easProjectId };

  return { expo: config };
};
