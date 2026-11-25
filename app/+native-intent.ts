/** Something shared to Guiney from another app opens the import screen. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/recipe/import?shared=1';
    }
  } catch {
    // Not a full address: an ordinary path.
  }
  return path;
}
