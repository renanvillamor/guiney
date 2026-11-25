const fs = require('node:fs');
const path = require('node:path');

const { withDangerousMod } = require('expo/config-plugins');

const RULES = `
# ML Kit (reading recipe photos) creates these by name, so R8 thinks nothing uses them.
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }
-keep class com.google.mlkit.** { *; }
`;

/** Without these rules, reading a photo fails in release builds only. */
module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app/proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('com.google.mlkit')) fs.writeFileSync(file, current + RULES);
      return c;
    },
  ]);
