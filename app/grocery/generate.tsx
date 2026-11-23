import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useOverlay, whileCooking } from '@/components/Overlays';
import { planDates } from '@/components/plans';
import { FormScreen } from '@/components/Screen';
import { SheetRow } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { today } from '@/lib/dates';
import { useGrocery, usePlanner } from '@/store';
import { messageOf } from '@/store/account';

export default function GenerateGroceries() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const { plans, entries } = usePlanner();
  const { items, generate } = useGrocery();
  const now = today();
  const upcoming = plans.filter((plan) => plan.end_date >= now);
  const [chosen, setChosen] = useState<string[]>(
    planId && upcoming.some((plan) => plan.id === planId)
      ? [planId]
      : upcoming.map((plan) => plan.id),
  );
  const replaces = items.some((item) => item.source === 'plan' && !item.is_bought);

  if (upcoming.length === 0) {
    return (
      <FormScreen title="Make grocery list">
        <EmptyState
          variant="empty-groceries"
          title="No meals to shop for"
          body="Plan some meals first."
          action={{ title: 'Plan meals', onPress: () => router.replace('/planner/new') }}
        />
      </FormScreen>
    );
  }

  const make = async () => {
    try {
      const count = await whileCooking('Guiney is checking the fridge…', () => generate(chosen));
      router.dismissTo('/groceries');
      if (count === 0) {
        useOverlay
          .getState()
          .celebrate('All stocked up!', 'Everything in this plan is already in the fridge.');
      }
    } catch (error) {
      Alert.alert('Could not make the list', messageOf(error));
    }
  };

  return (
    <FormScreen
      title="Make grocery list"
      footer={
        <Button
          title="Make list"
          icon="basket-outline"
          disabled={chosen.length === 0}
          onPress={() => void make()}
          style={{ flex: 1 }}
        />
      }>
      <Txt color="textMuted">
        Adds up every recipe from today onwards and takes off what is in the fridge.
        {replaces ? ' The list made from your last plan is replaced; items you added stay.' : ''}
      </Txt>
      {upcoming.map((plan) => {
        const dishes = entries.filter(
          (entry) => entry.plan_id === plan.id && entry.recipe_id && entry.date >= now,
        ).length;
        return (
          <SheetRow
            key={plan.id}
            title={planDates(plan)}
            subtitle={dishes === 1 ? '1 dish to cook' : `${dishes} dishes to cook`}
            selected={chosen.includes(plan.id)}
            onPress={() =>
              setChosen((ids) =>
                ids.includes(plan.id) ? ids.filter((id) => id !== plan.id) : [...ids, plan.id],
              )
            }
          />
        );
      })}
    </FormScreen>
  );
}
