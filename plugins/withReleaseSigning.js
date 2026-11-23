const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `        release {
            if (findProperty('GUINEY_RELEASE_STORE_FILE')) {
                storeFile file(findProperty('GUINEY_RELEASE_STORE_FILE'))
                storePassword findProperty('GUINEY_RELEASE_STORE_PASSWORD')
                keyAlias findProperty('GUINEY_RELEASE_KEY_ALIAS')
                keyPassword findProperty('GUINEY_RELEASE_KEY_PASSWORD')
            }
        }
`;

/**
 * Signs release builds with the private key named in ~/.gradle/gradle.properties. Without
 * it the APK comes out unsigned, never signed with the public debug key by accident.
 */
module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    const gradle = c.modResults.contents;
    if (gradle.includes('GUINEY_RELEASE_STORE_FILE')) return c;
    const withKey = gradle.replace(/(signingConfigs \{\r?\n)/, `$1${SIGNING}`);
    const signed = withKey.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?signingConfig )signingConfigs\.debug/,
      "$1(findProperty('GUINEY_RELEASE_STORE_FILE') ? signingConfigs.release : null)",
    );
    if (withKey === gradle || signed === withKey) {
      throw new Error('withReleaseSigning: android/app/build.gradle has changed shape');
    }
    c.modResults.contents = signed;
    return c;
  });
