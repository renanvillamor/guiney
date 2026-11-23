const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Windows builds fail when a C++ object path passes 260 characters. This tells CMake to
 * hash long ones. Harmless on macOS and Linux, where the limit does not exist.
 */
module.exports = function withShortObjectPaths(config) {
  return withAppBuildGradle(config, (mod) => {
    const marker = 'CMAKE_OBJECT_PATH_MAX';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /defaultConfig \{/,
        `defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-D${marker}=220"
            }
        }`,
      );
    }
    return mod;
  });
};
