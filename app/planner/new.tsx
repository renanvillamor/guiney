import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Choice';
import { cookPlan, planNotes } from '@/components/plans';
import { FormScreen, Section } from '@/components/Screen';
import { SheetRow } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { formatDate, planRange, today, type PlanRange } from '@/lib/dates';
import { useHousehold, usePlanner, useRecipes } from '@/store';
import { messageOf } from '@/store/account';

const RANGES: { value: PlanRange; label: string }[] = [
  { value: 'this-week', label: 'This week' },
  { value: 'next-week', label: 'Next week' },
  { value: 'two-weeks', label: 'Next 2 weeks' },
];

export default function NewPlan() {
  const members = useHousehold((state) => state.members);
  const recipes = useRecipes((state) => state.recipes);
  const { plans, slots, createPlan, removePlan, select, setNotes } = usePlanner();
  const [range, setRange] = useState<PlanRange>('this-week');
  const [eating, setEating] = useState(members.map((member) => member.id));
  const [busy, setBusy] = useState(false);

  const dates = planRange(range, today());
  const overlapping = plans.filter(
    (plan) => plan.start_date <= dates.end && plan.end_date >= dates.start,
  );

  const make = async (generate: boolean) => {
    setBusy(true);
    try {
      for (const plan of overlapping) await removePlan(plan.id);
      // Everyone is stored as an empty list, so people added later are included.
      const everyone = eating.length === members.length;
      const id = await createPlan(dates.start, dates.end, everyone ? [] : eating);
      select(id);
      router.back();
      if (generate) {
        const result = await cookPlan(id);
        if (result) {
          setNotes(id, planNotes(result, (slotId) => slots.find((s) => s.id === slotId)?.name ?? ''));
        }
      }
    } catch (error) {
      setBusy(false);
      Alert.alert('Could not make the plan', messageOf(error));
    }
  };

  const start = (generate: boolean) => {
    if (overlapping.length === 0) {
      void make(generate);
      return;
    }
    Alert.alert(
      'Replace your current plan?',
      'You already have a plan for some of these days. Its meals, including locked ones, will be removed.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => void make(generate) },
      ],
    );
  };

  return (
    <FormScreen
      title="New plan"
      footer={
        <View style={styles.footer}>
          <Button
            title="Generate plan"
            icon="pot-mix-outline"
            loading={busy}
            disabled={recipes.length === 0 || (members.length > 0 && eating.length === 0)}
            onPress={() => start(true)}
          />
          <Button kind="plain" title="Start with an empty plan" disabled={busy} onPress={() => start(false)} />
        </View>
      }>
      <Section title="When">
        <View>
          {RANGES.map(({ value, label }) => {
            const { start: from, end } = planRange(value, today());
            return (
              <SheetRow
                key={value}
                title={label}
                subtitle={`${formatDate(from)} to ${formatDate(end)}`}
                selected={range === value}
                onPress={() => setRange(value)}
              />
            );
          })}
        </View>
      </Section>
      {members.length > 0 ? (
        <Section title="Who is eating" hint="Their allergies and diets are never broken.">
          <ChipGroup>
            {members.map((member) => (
              <Chip
                key={member.id}
                multi
                label={`${member.avatar} ${member.name}`}
                selected={eating.includes(member.id)}
                onPress={() =>
                  setEating((ids) =>
                    ids.includes(member.id)
                      ? ids.filter((id) => id !== member.id)
                      : [...ids, member.id],
                  )
                }
              />
            ))}
          </ChipGroup>
        </Section>
      ) : null}
      {recipes.length === 0 ? (
        <Txt color="textMuted">Add a recipe first. Plans are made only from your own recipes.</Txt>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({ footer: { flex: 1, gap: 4 } });
