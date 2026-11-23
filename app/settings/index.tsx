import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { Input } from '@/components/Fields';
import { Guiney } from '@/components/Guiney';
import { Card, FormScreen, LinkRow, Section } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSettings } from '@/store';
import { messageOf, useAccount } from '@/store/account';
import { spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

export default function Settings() {
  const colors = useColors();
  const { theme, unitSystem, syncEnabled, householdName, inviteCode, lastSyncedAt, set } = useSettings();
  const { session, status, error, rename, sync, signOut } = useAccount();
  const [name, setName] = useState(householdName);
  const [renameError, setRenameError] = useState<string | null>(null);

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed === householdName) {
      setName(householdName);
      return;
    }
    try {
      setRenameError(null);
      await rename(trimmed);
    } catch (cause) {
      setRenameError(messageOf(cause));
    }
  };

  const connected = session !== null && inviteCode !== null;

  return (
    <FormScreen title="Settings">
      <Section title="Theme">
        <Segmented
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={theme}
          onChange={(value) => void set({ theme: value })}
        />
      </Section>

      <Section title="Units" hint="Amounts you already saved are converted.">
        <Segmented
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
          value={unitSystem}
          onChange={(value) => void set({ unitSystem: value })}
        />
      </Section>

      <Section title="Household">
        <Input
          label="Household name"
          value={name}
          onChangeText={setName}
          onBlur={() => void saveName()}
          onSubmitEditing={() => void saveName()}
          maxLength={80}
          returnKeyType="done"
        />
        {renameError ? (
          <Txt variant="caption" color="danger">
            {renameError}
          </Txt>
        ) : null}
        <Card padded={false}>
          <LinkRow
            title="Members"
            subtitle="Diets, allergies and favourites"
            last={!isSupabaseConfigured}
            onPress={() => router.dismissTo('/profile')}
          />
          {isSupabaseConfigured ? (
            <LinkRow
              last
              title={connected ? 'Invite or switch household' : 'Join a household'}
              subtitle={connected ? 'Share your invite code' : 'Cook from the same book on every phone'}
              onPress={() => router.push(session ? '/auth/household' : '/auth/sign-in')}
            />
          ) : null}
        </Card>
      </Section>

      <Section title="Sync">
        {!isSupabaseConfigured ? (
          <Txt color="textMuted">
            This build has no server set up, so everything stays on this phone.
          </Txt>
        ) : (
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">Sync with household</Txt>
                <Txt variant="caption" color={status === 'error' ? 'danger' : 'textMuted'}>
                  {!session
                    ? 'Sign in to turn this on.'
                    : !inviteCode
                      ? 'Create or join a household first.'
                      : status === 'syncing'
                        ? 'Syncing…'
                        : status === 'error'
                          ? error
                          : lastSyncedAt
                            ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                            : 'Not synced yet'}
                </Txt>
              </View>
              <Switch
                accessibilityLabel="Sync with household"
                value={syncEnabled && connected}
                disabled={!connected}
                onValueChange={(value) => {
                  void set({ syncEnabled: value }).then(() => {
                    if (value) void sync();
                  });
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
              />
            </View>
            {connected && syncEnabled ? (
              <Button
                kind="tint"
                icon="refresh"
                title="Sync now"
                loading={status === 'syncing'}
                onPress={() => void sync()}
              />
            ) : null}
            {session ? (
              <Button kind="plain" icon="logout" title="Sign out" onPress={() => void signOut()} />
            ) : (
              <Button title="Sign in" onPress={() => router.push('/auth/sign-in')} />
            )}
          </Card>
        )}
      </Section>

      <View style={styles.about}>
        <Guiney variant="icon" size={88} decorative />
        <Txt variant="caption" color="textMuted" center>
          Guiney {Constants.expoConfig?.version}
        </Txt>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  about: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
