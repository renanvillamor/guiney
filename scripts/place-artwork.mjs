// Copies supplied artwork into the app.
//   npm run artwork -- path/to/folder
//   npm run artwork                      after replacing assets/images/logo.png by hand
// Recognised files: guiney-logo-2.png, guiney-splash-screen.png, adaptive-icon.png,
// and any <variant>.png (empty-recipes.png, cooking.png, ...).
// Variants identical to the previous logo are placeholders, so they follow the new one.
// mascot/icon.png is the copy made last time, which identifies them when logo.png was
// replaced by hand.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const images = join(root, 'assets/images');
const mascot = join(root, 'assets/mascot');
const variants = [
  'icon',
  'splash',
  'empty-recipes',
  'empty-fridge',
  'empty-groceries',
  'cooking',
  'celebrate',
  'warning',
];

const source = process.argv[2] ? resolve(process.argv[2]) : null;
const logo = join(images, 'logo.png');
const oldLogos = [logo, join(mascot, 'icon.png')].filter(existsSync).map((f) => readFileSync(f));

if (source) {
  for (const [from, to] of [
    ['guiney-logo-2.png', logo],
    ['guiney-splash-screen.png', join(images, 'splash.png')],
    ['adaptive-icon.png', join(images, 'adaptive-icon.png')],
  ]) {
    if (existsSync(join(source, from))) {
      copyFileSync(join(source, from), to);
      console.log(`placed ${from}`);
    }
  }
}

for (const variant of variants) {
  const target = join(mascot, `${variant}.png`);
  const supplied = source && join(source, `${variant}.png`);
  if (supplied && existsSync(supplied)) {
    copyFileSync(supplied, target);
    console.log(`placed ${variant}.png`);
  } else if (!existsSync(target) || oldLogos.some((old) => readFileSync(target).equals(old))) {
    copyFileSync(logo, target);
    console.log(`placeholder ${variant}.png (logo)`);
  }
}
