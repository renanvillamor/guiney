// expo-router brings these in for its drawer, which Guiney does not use. Leaving their
// native code out keeps the APK smaller and keeps Windows builds under the 260-character
// path limit. Remove a line here if you start using that library.
const off = { platforms: { android: null, ios: null } };

module.exports = {
  dependencies: {
    'react-native-gesture-handler': off,
    'react-native-reanimated': off,
    'react-native-worklets': off,
  },
};
