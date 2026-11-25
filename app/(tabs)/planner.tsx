import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Chip } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { cookingTime, DaySummary, dishesOf, DishSheet, MealCard } from '@/components/Meals';
import { cookPlan, planDates, planNotes } from '@/components/plans';
import { TabScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { addDays, dateRange, formatDate, today, weekday } from '@/lib/dates';
import { usePlanner, usePrecooked, useRecipes } from '@/store';
import { useActivePlan } from '@/store/planner';
import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import type { MealPlan } from '@/types/models';

export default function Planner() {
  const plans = usePlanner((state) => state.plans);
  const { plan, select } = useActivePlan();

  return (
    <TabScreen
      title="Planner"
      actions={
        <>
          <IconButton
            icon="silverware-fork-knife"
            label="Edit meal slots"
            onPress={() => router.push('/planner/slots')}
          />
          <IconButton
            icon="calendar-plus"
            label="New plan"
            color="accentText"
            onPress={() => router.push('/planner/new')}
          />
        </>
      }>
      {plan ? (
        <>
          {plans.length > 1 ? (
            <ScrollView
              horizontal
              style={styles.noGrow}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              {plans.map((row) => (
                <Chip
                  key={row.id}
                  label={planDates(row)}
                  selected={row.id === plan.id}
                  onPress={() => select(row.id)}
                />
              ))}
            </ScrollView>
          ) : null}
          <Agenda key={plan.id} plan={plan} />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.noPlan}>
          <EmptyState
            variant="cooking"
            title="No plan yet"
            body="Pick a week and Guiney will fill it from your recipes, starting with what is already cooked."
            action={{ title: 'Plan meals', onPress: () => router.push('/planner/new') }}
          />
        </ScrollView>
      )}
    </TabScreen>
  );
}

function Agenda({ plan }: { plan: MealPlan }) {
  const colors = useColors();
  const now = today();
  const slots = usePlanner((state) => state.slots);
  const allEntries = usePlanner((state) => state.entries);
  const notes = usePlanner((state) => state.notes[plan.id]);
  const recipes = useRecipes((state) => state.recipes);
  const meals = usePrecooked((state) => state.meals);

  const days = dateRange(plan.start_date, plan.end_date);
  const [view, setView] = useState<'day' | 'plan'>('day');
  const [date, setDate] = useState(days.includes(now) ? now : (days[0] ?? now));
  const [pickedId, setPickedId] = useState<string | null>(null);

  const entries = allEntries.filter((entry) => entry.plan_id === plan.id);
  const dishes = dishesOf(entries, recipes, meals);
  const onDay = dishes.filter(({ entry }) => entry.date === date);
  const picked = dishes.find(({ entry }) => entry.id === pickedId) ?? null;
  const open = entries.filter((entry) => !entry.locked && entry.date >= now).length;

  const regenerate = async () => {
    const result = await cookPlan(plan.id);
    if (result) {
      usePlanner.getState().setNotes(
        plan.id,
        planNotes(result, (id) => slots.find((slot) => slot.id === id)?.name ?? ''),
      );
    }
  };

  const dayName = date === now ? 'Today' : weekday(date).slice(0, 3);
  const time = cookingTime(onDay);
  const summary =
    onDay.length === 0
      ? 'Nothing planned yet'
      : `${onDay.length === 1 ? '1 dish' : `${onDay.length} dishes`}${time ? `, ${time}` : ''}`;

  return (
    <>
      <View style={styles.bar}>
        {view === 'day' ? (
          <>
            <IconButton
              icon="chevron-left"
              label="Previous day"
              disabled={date === days[0]}
              onPress={() => setDate(addDays(date, -1))}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${dayName}, ${formatDate(date)}. ${summary}`}
              accessibilityHint="Shows the whole plan"
              onPress={() => setView('plan')}
              style={({ pressed }) => [
                styles.date,
                { backgroundColor: pressed ? colors.primaryTint : 'transparent' },
              ]}>
              <View style={styles.dateName}>
                <Txt
                  variant="heading"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={styles.shrink}>
                  {dayName}, {formatDate(date)}
                </Txt>
                <Icon name="chevron-down" size={20} color="textMuted" />
              </View>
              <Txt variant="caption" color="textMuted" numberOfLines={1}>
                {summary}
              </Txt>
            </Pressable>
            <IconButton
              icon="chevron-right"
              label="Next day"
              disabled={date === days.at(-1)}
              onPress={() => setDate(addDays(date, 1))}
            />
          </>
        ) : (
          <View style={styles.planName}>
            <Txt variant="heading">{planDates(plan)}</Txt>
          </View>
        )}
        <IconButton
          icon="pencil-outline"
          label="Edit plan"
          onPress={() => router.push({ pathname: '/planner/[id]', params: { id: plan.id } })}
        />
        <IconButton
          icon="refresh"
          label={open > 0 ? 'Regenerate plan' : 'Generate plan'}
          onPress={() => void regenerate()}
        />
      </View>

      <ScrollView key={view === 'day' ? date : view} contentContainerStyle={styles.content}>
        {notes && notes.length > 0 ? (
          <View style={[styles.notes, { backgroundColor: colors.primaryTint }]}>
            {notes.map((note) => (
              <Txt key={note} variant="label">
                {note}
              </Txt>
            ))}
          </View>
        ) : null}

        {view === 'day' ? (
          slots.map((slot) => (
            <MealCard
              key={slot.id}
              plan={plan}
              slot={slot}
              date={date}
              dishes={onDay.filter(({ entry }) => entry.slot_id === slot.id)}
              onPick={setPickedId}
            />
          ))
        ) : (
          days.map((day) => (
            <DaySummary
              key={day}
              date={day}
              slots={slots}
              dishes={dishes.filter(({ entry }) => entry.date === day)}
              onPress={() => {
                setDate(day);
                setView('day');
              }}
            />
          ))
        )}

        {slots.length === 0 ? (
          <Txt center color="textMuted">
            Add a meal slot to start planning.
          </Txt>
        ) : null}
        <Button
          icon="basket-outline"
          title="Make grocery list"
          onPress={() => router.push({ pathname: '/grocery/generate', params: { planId: plan.id } })}
        />
      </ScrollView>

      <DishSheet
        plan={plan}
        slot={slots.find((slot) => slot.id === picked?.entry.slot_id)}
        dish={picked}
        onClose={() => setPickedId(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noGrow: { flexGrow: 0 },
  // As tall as the controls above the empty Fridge and Groceries lists, so Guiney does not
  // jump when switching tabs.
  noPlan: { paddingTop: TOUCH + spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  date: {
    flex: 1,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  dateName: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  shrink: { flexShrink: 1 },
  planName: { flex: 1, paddingLeft: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  notes: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
