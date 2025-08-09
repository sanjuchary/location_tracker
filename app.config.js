import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }) => ({
  ...config,
  name: process.env.NODE_ENV === 'production' ? 'Location Tracker' : 'Location Tracker (Dev)',
  slug: 'location-tracker',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.sanjay-kumar-p.boltexponativewind',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'This app needs access to location to track your position for delivery services.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'This app needs access to location to track your position for delivery services.'
    }
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png'
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location to track your position for delivery services.',
        locationAlwaysPermission: 'Allow $(PRODUCT_NAME) to use your location to track your position for delivery services.',
        locationWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location to track your position for delivery services.'
      }
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          buildToolsVersion: '34.0.0'
        }
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  android: {
    package: 'com.sanjay_kumar_p.boltexponativewind',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#FFFFFF'
    },
    permissions: [
      'INTERNET',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'ACCESS_NETWORK_STATE',
      'WAKE_LOCK'
    ]
  },
  extra: {
    router: {},
    eas: {
      projectId: 'f7d35a8b-8ef7-4b72-b70f-ebc44e2e276d'
    },
    apiUrl: process.env.NODE_ENV === 'production' 
      ? 'http://51.21.221.235/api' 
      : 'http://51.21.221.235/api'
  }
});
