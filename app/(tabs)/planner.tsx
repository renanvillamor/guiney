import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Chip } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { cookPlan, planDates, planNotes } from '@/components/plans';
import { TabScreen } from '@/components/Screen';
import { Sheet, SheetRow } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { dateRange, formatDate, today, weekday } from '@/lib/dates';
import { allergenHits, isSafeFor } from '@/lib/dietary';
import { usePlanner, useHousehold, usePrecooked, useRecipes } from '@/store';
import { planMembers, useActivePlan } from '@/store/planner';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import type { MealPlan, MealPlanEntry, MealSlot } from '@/types/models';

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
        <ScrollView>
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
  const [picked, setPicked] = useState<{ date: string; slot: MealSlot } | null>(null);

  const entries = allEntries.filter((entry) => entry.plan_id === plan.id);
  const entryAt = (date: string, slotId: string) =>
    entries.find((entry) => entry.date === date && entry.slot_id === slotId);
  const days = dateRange(plan.start_date, plan.end_date);
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

  return (
    <>
      <ScrollView contentContainerStyle={styles.agenda}>
        <View style={styles.planHead}>
          <View style={styles.flex}>
            <Txt variant="heading">{planDates(plan)}</Txt>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/planner/[id]', params: { id: plan.id } })}
              hitSlop={8}>
              <Txt variant="label" color="accentText">
                Edit plan
              </Txt>
            </Pressable>
          </View>
          <Button
            kind="tint"
            icon="refresh"
            title={open > 0 ? 'Regenerate' : 'Generate'}
            onPress={() => void regenerate()}
          />
        </View>

        {notes && notes.length > 0 ? (
          <View style={[styles.notes, { backgroundColor: colors.primaryTint }]}>
            {notes.map((note) => (
              <Txt key={note} variant="label">
                {note}
              </Txt>
            ))}
          </View>
        ) : null}

        {days.map((date) => {
          const isToday = date === now;
          const past = date < now;
          return (
            <View key={date} style={[styles.day, past ? styles.past : null]}>
              <View style={styles.dateColumn}>
                <Txt variant="label" color={isToday ? 'accentText' : 'textMuted'}>
                  {weekday(date).slice(0, 3)}
                </Txt>
                <View
                  accessible
                  accessibilityLabel={`${weekday(date)} ${formatDate(date)}${isToday ? ', today' : ''}`}
                  style={[
                    styles.dateNumber,
                    { backgroundColor: isToday ? colors.fill : 'transparent' },
                  ]}>
                  <Txt variant="heading" color={isToday ? 'onFill' : 'text'}>
                    {Number(date.slice(8))}
                  </Txt>
                </View>
              </View>
              <View
                style={[styles.board, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {slots.map((slot, index) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    entry={entryAt(date, slot.id)}
                    plan={plan}
                    first={index === 0}
                    onPress={() => setPicked({ date, slot })}
                  />
                ))}
              </View>
            </View>
          );
        })}
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

      <SlotSheet
        plan={plan}
        picked={picked}
        entry={picked ? entryAt(picked.date, picked.slot.id) : undefined}
        onClose={() => setPicked(null)}
      />
    </>
  );
}

function useMealName(entry: MealPlanEntry | undefined) {
  const recipes = useRecipes((state) => state.recipes);
  const meals = usePrecooked((state) => state.meals);
  if (!entry) return null;
  if (entry.recipe_id) {
    const recipe = recipes.find((row) => row.id === entry.recipe_id);
    return recipe ? { name: recipe.title, precooked: false, recipe } : null;
  }
  const meal = meals.find((row) => row.id === entry.precooked_meal_id);
  if (!meal) return null;
  return {
    name: meal.name,
    precooked: true,
    recipe: recipes.find((row) => row.id === meal.recipe_id),
  };
}

function SlotRow({
  slot,
  entry,
  plan,
  first,
  onPress,
}: {
  slot: MealSlot;
  entry: MealPlanEntry | undefined;
  plan: MealPlan;
  first: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const members = useHousehold((state) => state.members);
  const meal = useMealName(entry);
  // Only a hand-picked meal can be unsafe, or one planned before someone's profile changed.
  const unsafe = meal?.recipe ? !isSafeFor(meal.recipe, planMembers(plan, members)) : false;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${slot.name}: ${meal?.name ?? 'empty'}${entry?.locked ? ', locked' : ''}${unsafe ? ', not suitable for everyone' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.slot,
        {
          borderTopColor: colors.border,
          borderTopWidth: first ? 0 : 1,
          backgroundColor: pressed || entry?.locked ? colors.primaryTint : 'transparent',
        },
      ]}>
      <View style={styles.flex}>
        <Txt variant="caption" color="textMuted">
          {slot.name}
        </Txt>
        {meal ? (
          <Txt variant="bodyStrong" numberOfLines={2}>
            {meal.name}
          </Txt>
        ) : (
          <Txt color="textMuted">Choose a meal</Txt>
        )}
        {meal?.precooked ? (
          <View style={styles.tag}>
            <Icon name="fridge-outline" size={14} color="secondary" />
            <Txt variant="caption" color="secondary">
              Already cooked
            </Txt>
          </View>
        ) : null}
      </View>
      {unsafe ? <Icon name="alert" size={20} color="danger" /> : null}
      {entry?.locked ? <Icon name="lock" size={18} color="accentText" /> : null}
    </Pressable>
  );
}

function SlotSheet({
  plan,
  picked,
  entry,
  onClose,
}: {
  plan: MealPlan;
  picked: { date: string; slot: MealSlot } | null;
  entry: MealPlanEntry | undefined;
  onClose: () => void;
}) {
  const { setLocked, clearEntry } = usePlanner();
  const members = useHousehold((state) => state.members);
  const meal = useMealName(entry);
  const choose = () => {
    if (!picked) return;
    onClose();
    router.push({
      pathname: '/planner/pick',
      params: { planId: plan.id, date: picked.date, slotId: picked.slot.id },
    });
  };
  const risky = meal?.recipe
    ? planMembers(plan, members).flatMap((member) =>
        allergenHits(meal.recipe!, member.allergies).map((hit) => `${member.name}: ${hit.allergy}`),
      )
    : [];

  return (
    <Sheet
      visible={picked !== null}
      title={
        picked ? `${weekday(picked.date)} ${picked.slot.name.toLowerCase()}` : ''
      }
      onClose={onClose}>
      {meal ? (
        <View style={styles.sheetMeal}>
          <Txt variant="subheading">{meal.name}</Txt>
          {risky.length > 0 ? (
            <Txt variant="label" color="danger">
              Allergy warning for {risky.join(', ')}
            </Txt>
          ) : null}
        </View>
      ) : null}
      <SheetRow
        icon={meal ? 'swap-horizontal' : 'plus'}
        title={meal ? 'Swap for another meal' : 'Choose a meal'}
        onPress={choose}
      />
      {meal?.recipe ? (
        <SheetRow
          icon="book-open-page-variant-outline"
          title="View recipe"
          onPress={() => {
            onClose();
            router.push({ pathname: '/recipe/[id]', params: { id: meal.recipe!.id } });
          }}
        />
      ) : null}
      {entry && meal ? (
        <>
          <SheetRow
            icon={entry.locked ? 'lock-open-variant-outline' : 'lock-outline'}
            title={entry.locked ? 'Unlock' : 'Lock'}
            subtitle={entry.locked ? undefined : 'Regenerating will keep this meal.'}
            onPress={() => {
              onClose();
              void setLocked(entry.id, !entry.locked);
            }}
          />
          <SheetRow
            icon="eraser"
            title="Clear"
            danger
            onPress={() => {
              onClose();
              void clearEntry(entry.id);
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noGrow: { flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  agenda: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notes: { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  day: { flexDirection: 'row', gap: spacing.md },
  past: { opacity: 0.55 },
  dateColumn: { width: 44, alignItems: 'center', paddingTop: spacing.xs },
  dateNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: { flex: 1, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetMeal: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
