/** Releases live on GitHub. Each needs a version tag and this APK attached. */
const RELEASES = 'https://github.com/renanvillamor/guiney/releases';
const APK = 'Guiney.apk';

export interface Release {
  version: string;
  apkUrl: string;
}

const parts = (version: string) =>
  version
    .trim()
    .replace(/^v/i, '')
    .split(/[-+]/, 1)[0]!
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

/** Compares by number, so 1.10 is newer than 1.9 and v1.1 equals 1.1.0. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

/**
 * The newest release, or null when nothing has been released. GitHub redirects
 * /releases/latest to the tag, which unlike its API has no hourly limit per address.
 */
export async function latestRelease(get: typeof fetch = fetch): Promise<Release | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 10_000);
  try {
    const response = await get(`${RELEASES}/latest`, { method: 'HEAD', signal: stop.signal });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    const tag = /\/releases\/tag\/([^/?#]+)/.exec(response.url)?.[1];
    if (tag) {
      return {
        version: decodeURIComponent(tag).replace(/^v/i, ''),
        apkUrl: `${RELEASES}/download/${tag}/${APK}`,
      };
    }
    // With no releases the redirect goes to the empty list. Anything else is not GitHub's
    // answer, such as a Wi-Fi sign-in page.
    if (response.url.replace(/\/$/, '') === RELEASES) return null;
    throw new Error('Unexpected answer');
  } finally {
    clearTimeout(timer);
  }
}
