# Guiney

A household cookbook and meal planner for Android. Recipes, a fridge, a meal planner that respects
allergies and diets, and a grocery list that knows what you already have. It works fully offline;
sharing with a household through Supabase is optional.

Built with Expo SDK 58, TypeScript (strict), Expo Router, Zustand, expo-sqlite and Supabase.

## Run it

You need Node 22 or newer, JDK 17 and the Android SDK (platform 37, build tools 37, NDK 27.1).

```bash
npm install
npm run android          # builds the native app and starts Metro
```

`npx expo start` also works in Expo Go, for quick changes (not for reading photos or receiving shares). The app icon, the splash and the colour of
system dialogs are native, so check those in a build like the one above. Set `ANDROID_HOME` if the SDK is not found. On Windows that is usually
`%LOCALAPPDATA%\Android\Sdk`.

A standalone APK for phones and emulators:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64
# android/app/build/outputs/apk/release/app-release.apk
```

`android/` is generated and not committed. Change native settings in `app.config.ts`.

Release builds are signed with a private key. `~/.gradle/gradle.properties`, which is never committed,
names it with `GUINEY_RELEASE_STORE_FILE`, `GUINEY_RELEASE_KEY_ALIAS`, `GUINEY_RELEASE_STORE_PASSWORD` and
`GUINEY_RELEASE_KEY_PASSWORD`. Without them the APK comes out unsigned and will not install. Back up the
key and those four lines together: an update signed with another key cannot replace an installed app.

## Release a new version

Profile, Update version looks at this repository's GitHub Releases when tapped. To publish one:

1. Raise `version` and `android.versionCode` in `app.config.ts`.
2. Build the APK as above.
3. Create a release tagged `v<version>` and attach the APK named exactly `Guiney.apk`.

## Check it

```bash
npm test             # Jest: planner, grocery, units, allergens, database, sync, contrast
npm run test:rls     # runs the Supabase migration on a local Postgres and attacks it
npm run typecheck
npm run lint
```

## Environment variables

Only needed for sync. Copy `.env.example` to `.env` and rebuild.

| Variable | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase, Project settings, API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same page, the anon / publishable key |

Leave them blank and the app hides everything about accounts.

### Set up Supabase

1. Create a project.
2. Run every file in `supabase/migrations`, in order (`supabase db push`, or paste them into the SQL editor).
3. Keep email sign-in enabled under Authentication.
4. In the app: Profile (top right of any tab), Sign in, create a household, share the code.

Row Level Security limits every table to members of its household. People join only with an invite
code, through `join_household()`. "New code" stops the old one working.

## Replace the Guiney artwork

The logo and splash are final. `adaptive-icon.png` is Guiney cut out of the logo, without the wordmark,
and every mascot variant is still the logo. To replace any of them, put your files in one folder and run:

```bash
npm run artwork -- path/to/folder
npx expo prebuild --platform android --clean   # the icon and splash are native
```

| File in your folder | Becomes |
|---|---|
| `guiney-logo-2.png` (1024×1024) | `assets/images/logo.png`, the app icon |
| `guiney-splash-screen.png` (848×1840) | `assets/images/splash.png` |
| `adaptive-icon.png` (1024×1024, transparent, no text, subject in the middle 66%) | `assets/images/adaptive-icon.png` |
| `icon.png`, `splash.png`, `empty-recipes.png`, `empty-fridge.png`, `empty-groceries.png`, `cooking.png`, `celebrate.png`, `warning.png` | `assets/mascot/`, one per `<Guiney variant>` |

A variant you have not supplied keeps using the logo and follows it when the logo changes. If you
replace `assets/images/logo.png` by hand, run `npm run artwork` on its own to update them.

The splash appears in two stages. Android 12 and later only let the system splash show a small image
in a circle, so the app then shows the full artwork itself until the database is open.

## How it is organised

```
app/            screens (Expo Router)
components/     shared UI; Guiney.tsx is the mascot
store/          Zustand, one store per domain
db/             SQLite schema, migrations, repositories, seed data
lib/            planner, grocery, units, allergens (dietary.ts), sync, dates
theme/          colours, type, spacing
plugins/        config plugins (dialog colour, Windows path length)
supabase/       migration with RLS
__tests__/      Jest
```

Screens read from stores. Stores call repositories. Repositories write SQLite and mark rows `dirty`
for sync. `lib/planner.ts`, `lib/grocery.ts`, `lib/units.ts` and `lib/dietary.ts` are pure functions.

## Rules worth knowing

- **Allergies** are matched by ingredient name, note and recipe title against word lists in
  `lib/dietary.ts`, plus anything typed by hand. It errs towards warning. It cannot know what is in a
  branded product, so labels still need reading.
- **Pre-cooked meals with no linked recipe** are never auto-planned when anyone eating has an allergy
  or diet, because their ingredients are unknown.
- **Expiry dates** are inclusive: food is good on the date and expired the day after. Pre-cooked meals
  are scheduled no later than that day.
- **Importing** a recipe only fills in the editor; nothing is saved until someone checks it. Websites are
  read from their schema.org recipe data. Sites that refuse a plain download open in Guiney's own browser
  instead. Photos are read on the phone with ML Kit and are not sent anywhere; this and Share need a real
  build, not Expo Go. Lines Guiney was unsure of say "Please check".
- **Main dish** is the category for viands. It fits breakfast, lunch and dinner equally.
- **Meals** hold any number of dishes. The generator plans a main dish first, then others of a
  different kind, up to "Dishes per meal" in Meal slots (2 for lunch and dinner, otherwise 1).
  Regenerating replaces every dish that is not locked. If two phones regenerate the same plan while
  offline, both results show after syncing; regenerate once more.
- **Groceries** merge the same name within weight, volume or count. Grams cannot be subtracted from
  pieces, so "2 onions" stays on the list even with 500 g of onion in the fridge. Expired food does
  not count as stock.
- **A new grocery list** replaces what an earlier plan still needed. Items added by hand, and items
  already ticked, stay.
- **Sync** sends changes about three seconds after an edit and when the app opens. The newer
  `updated_at` wins per row. **Recipe photos stay on the phone that took them.**
- **Sample data** (10 recipes, 2 members) is added on first launch. Samples you have not edited are
  left behind when you join another household.
- **White on `#F97316`** fails WCAG AA, so buttons are white on the deeper `#C2410C` (`fill` in
  `theme/colors.ts`). `__tests__/theme.test.ts` checks every pair.
