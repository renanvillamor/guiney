import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Card, FormScreen, LinkRow, Section } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { dietLabel } from '@/lib/dietary';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useHousehold, useSettings } from '@/store';
import { useAccount } from '@/store/account';
import { spacing } from '@/theme/spacing';
import type { Member } from '@/types/models';

function summary(member: Member): string {
  const parts = [dietLabel(member.diet)];
  if (member.allergies.length > 0) parts.push(`Allergic to ${member.allergies.join(', ')}`);
  return parts.join('\n');
}

export default function Profile() {
  const members = useHousehold((state) => state.members);
  const { householdName, inviteCode } = useSettings();
  const session = useAccount((state) => state.session);
  const add = () => router.push('/settings/member');

  return (
    <FormScreen title="Profile">
      <Section title={householdName} hint="Allergies and diets here shape every plan.">
        {members.length > 0 ? (
          <Card padded={false}>
            {members.map((member, index) => (
              <LinkRow
                key={member.id}
                last={index === members.length - 1}
                leading={<Txt style={styles.avatar}>{member.avatar}</Txt>}
                title={session && member.user_id === session.user.id ? `${member.name} (you)` : member.name}
                subtitle={summary(member)}
                onPress={() => router.push({ pathname: '/settings/member', params: { id: member.id } })}
              />
            ))}
          </Card>
        ) : (
          <EmptyState variant="icon" title="Who is eating?" body="Add the people you cook for." />
        )}
        <Button kind="tint" icon="account-plus-outline" title="Add member" onPress={add} />
      </Section>

      <Section title="Kitchen">
        <Card padded={false}>
          <LinkRow title="Pre-cooked meals" subtitle="Add, edit or remove" onPress={() => router.push('/precooked')} />
          <LinkRow title="Meal slots" subtitle="Breakfast, lunch and your own" onPress={() => router.push('/planner/slots')} />
          <LinkRow title="Settings" subtitle="Theme, units and sync" onPress={() => router.push('/settings')} last />
        </Card>
      </Section>

      {isSupabaseConfigured ? (
        <Section title="Share with your household">
          {!session ? (
            <View style={styles.gap}>
              <Txt color="textMuted">
                Sign in to keep every phone at home up to date. Guiney works without it too.
              </Txt>
              <Button title="Sign in" icon="cloud-sync-outline" onPress={() => router.push('/auth/sign-in')} />
            </View>
          ) : (
            <Card padded={false}>
              <LinkRow
                last
                title={inviteCode ? 'Invite someone' : 'Set up your household'}
                subtitle={session.user.email ?? undefined}
                onPress={() => router.push('/auth/household')}
              />
            </Card>
          )}
        </Section>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  avatar: { fontSize: 30, lineHeight: 40 },
  gap: { gap: spacing.md },
});
