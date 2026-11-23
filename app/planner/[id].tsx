import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { cookPlan, mealsAndDishes, planDates, planNotes } from '@/components/plans';
import { Card, FormScreen, LinkRow, Section } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { today } from '@/lib/dates';
import { isSafeFor } from '@/lib/dietary';
import { useHousehold, usePlanner, useRecipes } from '@/store';
import { planMembers } from '@/store/planner';

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plans, entries, slots, setMembers, removePlan, setNotes } = usePlanner();
  const members = useHousehold((state) => state.members);
  const recipes = useRecipes((state) => state.recipes);
  const plan = plans.find((row) => row.id === id);

  if (!plan) {
    return (
      <EmptyState
        variant="cooking"
        title="This plan is gone"
        action={{ title: 'Back to planner', onPress: () => router.dismissTo('/planner') }}
      />
    );
  }

  const eating = planMembers(plan, members);
  const mine = entries.filter((entry) => entry.plan_id === plan.id);
  const locked = mine.filter((entry) => entry.locked && entry.date >= today());
  const riskyLocked = locked.filter((entry) => {
    const recipe = recipes.find((row) => row.id === entry.recipe_id);
    return recipe ? !isSafeFor(recipe, eating) : false;
  });

  const toggle = (memberId: string) => {
    const ids = eating.map((member) => member.id);
    const next = ids.includes(memberId) ? ids.filter((other) => other !== memberId) : [...ids, memberId];
    // Someone has to eat.
    if (next.length > 0) void setMembers(plan.id, next.length === members.length ? [] : next);
  };

  const regenerate = async () => {
    const result = await cookPlan(plan.id);
    if (!result) return;
    setNotes(plan.id, planNotes(result, (slotId) => slots.find((s) => s.id === slotId)?.name ?? ''));
    router.back();
  };

  return (
    <FormScreen
      title="Edit plan"
      footer={<Button icon="refresh" title="Regenerate" onPress={() => void regenerate()} style={{ flex: 1 }} />}>
      <Txt variant="title">{planDates(plan)}</Txt>
      <Txt color="textMuted">
        {mealsAndDishes(mine)} planned
        {locked.length > 0 ? `, ${locked.length} locked` : ''}. Regenerating keeps locked dishes and
        days that have passed, and replaces the rest.
      </Txt>
      {riskyLocked.length > 0 ? (
        <Txt variant="label" color="danger">
          {riskyLocked.length === 1 ? 'A locked dish is' : `${riskyLocked.length} locked dishes are`}{' '}
          not suitable for everyone eating. Swap or unlock it in the planner.
        </Txt>
      ) : null}
      {members.length > 0 ? (
        <Section title="Who is eating" hint="Regenerate after changing this.">
          <ChipGroup>
            {members.map((member) => (
              <Chip
                key={member.id}
                multi
                label={`${member.avatar} ${member.name}`}
                selected={eating.some((other) => other.id === member.id)}
                onPress={() => toggle(member.id)}
              />
            ))}
          </ChipGroup>
        </Section>
      ) : null}
      <Card padded={false}>
        <LinkRow
          last
          title="Meal slots"
          subtitle={slots.map((slot) => slot.name).join(', ')}
          onPress={() => router.push('/planner/slots')}
        />
      </Card>
      <Button
        kind="danger"
        icon="trash-can-outline"
        title="Delete plan"
        onPress={() =>
          Alert.alert('Delete this plan?', 'Its meals and the groceries still to buy for it will go too.', [
            { text: 'Keep it', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                router.back();
                void removePlan(plan.id);
              },
            },
          ])
        }
      />
    </FormScreen>
  );
}
