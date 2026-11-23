import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { TextField } from '@/components/Fields';
import { useOverlay, whileCooking } from '@/components/Overlays';
import { Card, FormScreen, Section } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import type { RemoteHousehold } from '@/lib/supabase';
import { useSettings } from '@/store';
import { messageOf, useAccount } from '@/store/account';
import { spacing } from '@/theme/spacing';

/** Stands out from a name and is easy to read over the phone. */
const spaced = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

export default function Household() {
  const { session, households, create, joinByCode, connect, newInviteCode } = useAccount();
  const { householdId, householdName, inviteCode } = useSettings();
  const [mine, setMine] = useState<RemoteHousehold[]>([]);
  const [name, setName] = useState(householdName);
  const [code, setCode] = useState('');
  const [bring, setBring] = useState<'keep' | 'fresh'>('keep');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    households()
      .then((rows) => {
        if (!cancelled) setMine(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(messageOf(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [session, households, householdId]);

  if (!session) {
    return (
      <FormScreen title="Household">
        <Txt>Sign in first to share a household.</Txt>
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} />
      </FormScreen>
    );
  }

  const run = async (message: string, work: () => Promise<void>, done: string) => {
    setError(null);
    try {
      await whileCooking(message, work);
      useOverlay.getState().celebrate('You are all set!', done);
      setCode('');
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  /** Starting fresh erases local data, so it is confirmed. */
  const confirmed = (action: () => void) => {
    if (bring === 'keep') {
      action();
      return;
    }
    Alert.alert(
      'Erase the recipes on this phone?',
      "Everything here is replaced with the household's data. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase and join', style: 'destructive', onPress: action },
      ],
    );
  };

  const others = mine.filter((household) => household.id !== householdId || !inviteCode);

  return (
    <FormScreen title="Household">
      {error ? (
        <Txt color="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}

      {inviteCode ? (
        <Section title={householdName} hint="Anyone with this code can join and see everything.">
          <Card>
            <Txt variant="hero" center selectable accessibilityLabel={`Invite code ${inviteCode.split('').join(' ')}`}>
              {spaced(inviteCode)}
            </Txt>
            <View style={styles.row}>
              <Button
                icon="share-variant-outline"
                title="Share code"
                style={styles.flex}
                onPress={() =>
                  void Share.share({
                    message: `Join ${householdName} on Guiney with this code: ${spaced(inviteCode)}`,
                  })
                }
              />
              <Button
                kind="tint"
                icon="refresh"
                title="New code"
                style={styles.flex}
                onPress={() => {
                  setError(null);
                  newInviteCode().catch((cause: unknown) => setError(messageOf(cause)));
                }}
              />
            </View>
          </Card>
        </Section>
      ) : (
        <Section title="Start a household" hint="Puts what is on this phone online for your household.">
          <TextField label="Household name" value={name} onChangeText={setName} maxLength={80} />
          <Button
            title="Create household"
            disabled={name.trim() === ''}
            onPress={() =>
              void run('Guiney is setting the table…', () => create(name.trim()), 'Share the invite code to add people.')
            }
          />
        </Section>
      )}

      <Section title={inviteCode ? 'Switch to another household' : 'Join a household'}>
        <Segmented
          options={[
            { value: 'keep', label: 'Bring my recipes' },
            { value: 'fresh', label: 'Start fresh' },
          ]}
          value={bring}
          onChange={setBring}
        />
        <Txt variant="caption" color="textMuted">
          {bring === 'keep'
            ? 'Your own recipes, members, fridge and pre-cooked meals come along. Plans and groceries are replaced.'
            : "Everything on this phone is replaced with the household's data."}
        </Txt>
        {others.map((household) => (
          <Button
            key={household.id}
            kind="tint"
            title={`Connect to ${household.name}`}
            onPress={() =>
              confirmed(() =>
                void run(
                  'Guiney is fetching the cookbook…',
                  () => connect(household, bring === 'keep'),
                  `This phone now cooks with ${household.name}.`,
                ),
              )
            }
          />
        ))}
        <TextField
          label="Invite code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="A1B2C-3D4E5"
        />
        <Button
          title="Join with code"
          disabled={code.trim() === ''}
          onPress={() =>
            confirmed(() =>
              void run(
                'Guiney is fetching the cookbook…',
                () => joinByCode(code.trim(), bring === 'keep'),
                'You now share recipes, plans and groceries.',
              ),
            )
          }
        />
      </Section>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
});
