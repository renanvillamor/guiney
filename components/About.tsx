import Constants from 'expo-constants';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking } from 'react-native';

import { isNewerVersion, latestRelease, type Release } from '@/lib/appUpdate';
import { useColors } from '@/theme/ThemeProvider';

import { Icon } from './Icon';
import { Card, InfoRow, LinkRow, Section } from './Screen';

type Check =
  | { state: 'idle' | 'checking' | 'current' | 'none' | 'failed' }
  | { state: 'available'; release: Release };

const STATUS = {
  idle: 'Check for a newer version',
  checking: 'Checking for updates',
  current: "You're on the latest version",
  none: 'Nothing has been released yet',
  failed: 'Could not check. Connect to the internet and try again.',
};

/** The installed version, and a check against the published releases when asked. */
export function About() {
  const colors = useColors();
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const version = Constants.expoConfig?.version ?? '0.0.0';

  const press = async () => {
    if (check.state === 'checking') return;
    if (check.state === 'available') {
      try {
        await Linking.openURL(check.release.apkUrl);
      } catch {
        Alert.alert('Could not open the download', 'Install a web browser and try again.');
      }
      return;
    }
    setCheck({ state: 'checking' });
    try {
      const release = await latestRelease();
      if (!release) setCheck({ state: 'none' });
      else if (isNewerVersion(release.version, version)) setCheck({ state: 'available', release });
      else setCheck({ state: 'current' });
    } catch {
      setCheck({ state: 'failed' });
    }
  };

  return (
    <Section title="About">
      <Card padded={false}>
        <InfoRow title="App version" value={version} />
        <LinkRow
          last
          title="Update version"
          subtitle={
            check.state === 'available'
              ? `Version ${check.release.version} is available. Tap to download.`
              : STATUS[check.state]
          }
          onPress={() => void press()}
          trailing={
            check.state === 'checking' ? (
              <ActivityIndicator color={colors.accentText} />
            ) : check.state === 'available' ? (
              <Icon name="download" color="accentText" />
            ) : check.state === 'current' ? (
              <Icon name="check" color="secondary" />
            ) : (
              <Icon name="refresh" color="textMuted" />
            )
          }
        />
      </Card>
    </Section>
  );
}
