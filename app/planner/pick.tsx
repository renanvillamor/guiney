import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Fields';
import { CATEGORY_ICONS, categoryLabel, ExpiryBadge } from '@/components/Food';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { daysAgo, weekday } from '@/lib/dates';
import { allergyWarnings, dietConflict } from '@/lib/dietary';
import { normalizeName } from '@/lib/ingredients';
import { extrasForSlot, usableOn } from '@/lib/planner';
import { useHousehold, usePlanner, usePrecooked, useRecipes } from '@/store';
import { messageOf } from '@/store/account';
import { planMembers } from '@/store/planner';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import type { FullRecipe } from '@/types/models';

interface Option {
  key: string;
  name: string;
  detail: string;
  icon: IconName;
  expiry: string | null;
  allergy: string | null;
  diet: string | null;
  recipeId: string | null;
  precookedId: string | null;
}

/** Adds any number of dishes to a meal or, given an entry, swaps that one dish. */
export default function PickDishes() {
  const { planId, date, slotId, entryId } = useLocalSearchParams<{
    planId: string;
    date: string;
    slotId: string;
    entryId?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { plans, slots, entries, addDishes, swapDish } = usePlanner();
  const recipes = useRecipes((state) => state.recipes);
  const meals = usePrecooked((state) => state.meals);
  const members = useHousehold((state) => state.members);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Option[]>([]);

  const plan = plans.find((row) => row.id === planId);
  const slot = slots.find((row) => row.id === slotId);
  const eating = plan ? planMembers(plan, members) : members;

  const allergyFor = (recipe: FullRecipe | undefined) => {
    const warnings = recipe ? allergyWarnings(recipe, eating) : [];
    return warnings.length > 0
      ? warnings
          .map(({ member, hits }) => `${member.name}: ${hits.map((hit) => hit.allergy).join(', ')}`)
          .join('; ')
      : null;
  };
  const dietFor = (recipe: FullRecipe | undefined) => {
    const names = recipe
      ? eating.filter((member) => dietConflict(recipe, member.diet) !== null).map((m) => m.name)
      : [];
    return names.length > 0 ? `Outside ${names.join(' and ')}'s diet` : null;
  };

  // A container is eaten once, and a meal has each recipe once.
  const usedMeals = new Set(entries.map((entry) => entry.precooked_meal_id));
  const here = new Set(
    entries
      .filter((entry) => entry.plan_id === planId && entry.date === date && entry.slot_id === slotId)
      .map((entry) => entry.recipe_id),
  );
  const available = recipes.filter((recipe) => !here.has(recipe.id));
  const cooked: Option[] = meals
    .filter((meal) => !usedMeals.has(meal.id) && usableOn(meal, date))
    .map((meal) => {
      const recipe = recipes.find((row) => row.id === meal.recipe_id);
      return {
        key: meal.id,
        name: meal.name,
        detail: `Prepared ${daysAgo(meal.prepared_on)}`,
        icon: 'fridge-outline',
        expiry: meal.expiry_date,
        allergy: allergyFor(recipe),
        diet: dietFor(recipe),
        recipeId: null,
        precookedId: meal.id,
      };
    });

  const option = (recipe: FullRecipe): Option => ({
    key: recipe.id,
    name: recipe.title,
    detail: `${categoryLabel(recipe.category)}, ${recipe.prep_time_min + recipe.cook_time_min} min`,
    icon: CATEGORY_ICONS[recipe.category],
    expiry: null,
    allergy: allergyFor(recipe),
    diet: dietFor(recipe),
    recipeId: recipe.id,
    precookedId: null,
  });
  const wanted = slot ? extrasForSlot(slot.name) : [];
  const search = normalizeName(query);
  const sections = [
    { title: 'Already cooked', data: cooked },
    { title: `Good for ${slot?.name.toLowerCase() ?? 'this'}`, data: available.filter((r) => wanted.includes(r.category)).map(option) },
    { title: 'Everything else', data: available.filter((r) => !wanted.includes(r.category)).map(option) },
  ]
    .map((section) => ({
      ...section,
      data: section.data.filter((item) => normalizeName(item.name).includes(search)),
    }))
    .filter((section) => section.data.length > 0);

  const isChosen = (item: Option) => chosen.some((other) => other.key === item.key);
  const save = async (work: Promise<void>) => {
    try {
      await work;
      router.back();
    } catch (error) {
      Alert.alert('Could not change the meal', messageOf(error));
    }
  };
  const take = (item: Option) => {
    if (entryId) {
      void save(
        swapDish(entryId, { recipe_id: item.recipeId, precooked_meal_id: item.precookedId }),
      );
    } else {
      setChosen((items) => [...items, item]);
    }
  };
  const press = (item: Option) => {
    if (isChosen(item)) {
      setChosen((items) => items.filter((other) => other.key !== item.key));
    } else if (!item.allergy) {
      take(item);
    } else {
      Alert.alert('This is not safe for everyone', item.allergy, [
        { text: 'Pick another', style: 'cancel' },
        { text: 'Use it anyway', style: 'destructive', onPress: () => take(item) },
      ]);
    }
  };
  const addChosen = () =>
    void save(
      addDishes(
        planId,
        chosen.map((item) => ({
          date,
          slot_id: slotId,
          recipe_id: item.recipeId,
          precooked_meal_id: item.precookedId,
        })),
      ),
    );

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: slot ? `${weekday(date)} ${slot.name.toLowerCase()}` : 'Choose dishes' }} />
      <View style={styles.search}>
        <Input label="Search dishes" placeholder="Search dishes" value={query} onChangeText={setQuery} />
      </View>
      <SectionList
        sections={sections}
        extraData={chosen}
        style={styles.flex}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + (chosen.length > 0 ? 0 : insets.bottom) }}
        renderSectionHeader={({ section }) => (
          <Txt variant="heading" style={styles.header}>
            {section.title}
          </Txt>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole={entryId ? 'button' : 'checkbox'}
            accessibilityState={entryId ? undefined : { checked: isChosen(item) }}
            onPress={() => press(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed || isChosen(item) ? colors.primaryTint : colors.surface,
                borderColor: isChosen(item) ? colors.primary : colors.border,
              },
            ]}>
            <Icon name={item.icon} color="accentText" />
            <View style={styles.flex}>
              <Txt variant="bodyStrong">{item.name}</Txt>
              <Txt variant="caption" color="textMuted">
                {item.detail}
              </Txt>
              <ExpiryBadge date={item.expiry} />
              {item.allergy ? (
                <Txt variant="label" color="danger">
                  Allergy warning for {item.allergy}
                </Txt>
              ) : null}
              {item.diet ? (
                <Txt variant="label" color="accentText">
                  {item.diet}
                </Txt>
              ) : null}
            </View>
            {isChosen(item) ? <Icon name="check" color="accentText" /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            variant="empty-recipes"
            title={query ? 'No dish matches' : 'Guiney is hungry. Add your first recipe!'}
          />
        }
      />
      {chosen.length > 0 ? (
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md },
          ]}>
          <Button
            icon="plus"
            title={chosen.length === 1 ? 'Add 1 dish' : `Add ${chosen.length} dishes`}
            onPress={addChosen}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1 },
  header: { marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
});
