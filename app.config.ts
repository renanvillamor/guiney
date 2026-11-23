import type { ExpoConfig } from 'expo/config';

const CREAM = '#FFF8F1';

const config: ExpoConfig = {
  name: 'Guiney',
  slug: 'guiney',
  scheme: 'guiney',
  version: '1.0.0',
  orientation: 'portrait',
  platforms: ['android'],
  icon: './assets/images/logo.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: CREAM,
  android: {
    package: 'com.amawachoya.guiney',
    // Raise with every release.
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: CREAM,
    },
    softwareKeyboardLayoutMode: 'resize',
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
  },
  plugins: [
    'expo-router',
    [
      // SDK 58 configures the splash here; the top-level `splash` key was removed.
      'expo-splash-screen',
      {
        image: './assets/images/splash.png',
        resizeMode: 'contain',
        backgroundColor: CREAM,
        // Android 12+ masks the splash to a 192 dp circle. In a 240 dp box the middle of the
        // portrait artwork fits inside it. SplashOverlay (components/Overlays.tsx) then shows
        // the same artwork full screen while the database opens.
        imageWidth: 240,
      },
    ],
    './plugins/withShortObjectPaths',
    './plugins/withReleaseSigning',
    ['./plugins/withAccentColor', { light: '#C2410C', dark: '#FB923C' }],
    'expo-sqlite',
    [
      'expo-image-picker',
      {
        photosPermission: 'Guiney uses your photos to illustrate recipes.',
        cameraPermission: 'Guiney uses the camera to photograph your dishes.',
        microphonePermission: false,
      },
    ],
    '@react-native-community/datetimepicker',
    '@react-native-vector-icons/material-design-icons',
    [
      'expo-font',
      {
        fonts: [
          'node_modules/@expo-google-fonts/fredoka/500Medium/Fredoka_500Medium.ttf',
          'node_modules/@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf',
          'node_modules/@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf',
          'node_modules/@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf',
          'node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf',
        ],
      },
    ],
  ],
  experiments: { reactCompiler: true },
};

export default config;
