import { isNewerVersion, latestRelease } from '@/lib/appUpdate';

const RELEASES = 'https://github.com/renanvillamor/guiney/releases';
const answer = (url: string, status = 200) =>
  (async () => ({ ok: status < 400, status, url })) as unknown as typeof fetch;

describe('isNewerVersion', () => {
  it.each([
    ['1.0.1', '1.0.0', true],
    ['1.10.0', '1.9.0', true],
    ['2.0', '1.9.9', true],
    ['v1.1', '1.1.0', false],
    ['1.0.0', '1.0.0', false],
    ['0.9.9', '1.0.0', false],
    ['1.0.0-beta', '1.0.0', false],
  ])('%s over %s is %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});

describe('latestRelease', () => {
  it('reads the version and APK link from the redirect', async () => {
    await expect(latestRelease(answer(`${RELEASES}/tag/v1.2.0`))).resolves.toEqual({
      version: '1.2.0',
      apkUrl: `${RELEASES}/download/v1.2.0/Guiney.apk`,
    });
  });

  it('is null when nothing has been released', async () => {
    await expect(latestRelease(answer(RELEASES))).resolves.toBeNull();
  });

  it('fails on an error or a page that is not GitHub', async () => {
    await expect(latestRelease(answer(`${RELEASES}/latest`, 503))).rejects.toThrow('503');
    await expect(latestRelease(answer('https://wifi.example/login'))).rejects.toThrow();
  });
});
