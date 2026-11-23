import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { today, weekday } from '@/lib/dates';
import { allergenHits, isSafeFor } from '@/lib/dietary';
import { categoriesForSlot } from '@/lib/planner';
import { useHousehold, usePlanner } from '@/store';
import { planMembers } from '@/store/planner';
import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import type {
  Category,
  FullRecipe,
  MealPlan,
  MealPlanEntry,
  MealSlot,
  PrecookedMeal,
} from '@/types/models';

import { IconButton } from './Button';
import { CATEGORY_ICONS, RecipePhoto } from './Food';
import { Icon } from './Icon';
import { Card } from './Screen';
import { Sheet, SheetRow } from './Sheet';
import { Txt } from './Txt';

/** One food in a planned meal. */
export interface Dish {
  entry: MealPlanEntry;
  name: string;
  precooked: boolean;
  recipe: FullRecipe | undefined;
}

/** Main dishes first, then what goes with them. */
const SERVING_ORDER: Category[] = [
  'breakfast',
  'lunch',
  'dinner',
  'soup',
  'snack',
  'side',
  'dessert',
  'drink',
];
const rank = ({ recipe }: Dish) => (recipe ? SERVING_ORDER.indexOf(recipe.category) : 0);

export function dishesOf(
  entries: MealPlanEntry[],
  recipes: FullRecipe[],
  meals: PrecookedMeal[],
): Dish[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const mealById = new Map(meals.map((meal) => [meal.id, meal]));
  return entries
    .flatMap((entry): Dish[] => {
      const meal = entry.precooked_meal_id ? mealById.get(entry.precooked_meal_id) : undefined;
      const recipe = recipeById.get(entry.recipe_id ?? meal?.recipe_id ?? '');
      const name = meal?.name ?? (entry.recipe_id ? recipe?.title : undefined);
      return name === undefined ? [] : [{ entry, name, precooked: meal !== undefined, recipe }];
    })
    .sort((a, b) => rank(a) - rank(b));
}

export function cookingTime(dishes: Dish[]): string | null {
  const minutes = dishes.reduce(
    (sum, { precooked, recipe }) =>
      precooked || !recipe ? sum : sum + recipe.prep_time_min + recipe.cook_time_min,
    0,
  );
  if (minutes === 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 ? `${hours} h` : '', rest > 0 ? `${rest} min` : ''].filter(Boolean).join(' ');
}

/** A meal and everything in it. */
export function MealCard({
  plan,
  slot,
  date,
  dishes,
  onPick,
}: {
  plan: MealPlan;
  slot: MealSlot;
  date: string;
  dishes: Dish[];
  onPick: (entryId: string) => void;
}) {
  const colors = useColors();
  const members = useHousehold((state) => state.members);
  const eating = planMembers(plan, members);
  const time = dishes.length > 1 ? cookingTime(dishes) : null;
  const add = () =>
    router.push({ pathname: '/planner/pick', params: { planId: plan.id, date, slotId: slot.id } });

  return (
    <Card padded={false}>
      <View style={styles.head}>
        <Icon name={CATEGORY_ICONS[categoriesForSlot(slot.name)[0] ?? 'dinner']} size={20} color="accentText" />
        <Txt variant="heading" style={styles.flex} numberOfLines={1}>
          {slot.name}
        </Txt>
        {time ? (
          <Txt variant="caption" color="textMuted">
            {time}
          </Txt>
        ) : null}
        <IconButton icon="plus" color="accentText" label={`Add dishes to ${slot.name}`} onPress={add} />
      </View>
      {dishes.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${slot.name} is empty. Choose dishes`}
          onPress={add}
          style={({ pressed }) => [
            styles.empty,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.primaryTint : 'transparent',
            },
          ]}>
          <Txt color="textMuted">Choose dishes</Txt>
        </Pressable>
      ) : (
        dishes.map(({ entry, name, precooked, recipe }) => {
          // Only a hand-picked dish can be unsafe, or one planned before a profile changed.
          const unsafe = recipe ? !isSafeFor(recipe, eating) : false;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${slot.name}: ${name}${precooked ? ', already cooked' : ''}${entry.locked ? ', locked' : ''}${unsafe ? ', not suitable for everyone' : ''}`}
              onPress={() => onPick(entry.id)}
              style={({ pressed }) => [
                styles.dish,
                { backgroundColor: pressed || entry.locked ? colors.primaryTint : 'transparent' },
              ]}>
              {recipe ? (
                <RecipePhoto
                  uri={recipe.photo_uri}
                  category={recipe.category}
                  width={44}
                  height={44}
                  rounded={radius.sm}
                />
              ) : (
                <View style={[styles.tile, { backgroundColor: colors.primaryTint }]}>
                  <Icon name="fridge-outline" size={20} color="accentText" />
                </View>
              )}
              <View style={styles.flex}>
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {name}
                </Txt>
                {precooked ? (
                  <Txt variant="caption" color="secondary">
                    Already cooked
                  </Txt>
                ) : recipe ? (
                  <Txt variant="caption" color="textMuted">
                    {recipe.prep_time_min + recipe.cook_time_min} min
                  </Txt>
                ) : null}
              </View>
              {unsafe ? <Icon name="alert" size={20} color="danger" /> : null}
              {entry.locked ? <Icon name="lock" size={18} color="accentText" /> : null}
              <Icon name="dots-vertical" size={20} color="textMuted" />
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

/** A whole day in a few lines, for the week view. */
export function DaySummary({
  date,
  slots,
  dishes,
  onPress,
}: {
  date: string;
  slots: MealSlot[];
  dishes: Dish[];
  onPress: () => void;
}) {
  const colors = useColors();
  const isToday = date === today();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens this day"
      onPress={onPress}
      style={({ pressed }) => [
        styles.summary,
        {
          backgroundColor: pressed ? colors.primaryTint : colors.surface,
          borderColor: isToday ? colors.primary : colors.border,
          opacity: date < today() ? 0.6 : 1,
        },
      ]}>
      <View style={styles.summaryDate}>
        <Txt variant="caption" color={isToday ? 'accentText' : 'textMuted'}>
          {weekday(date).slice(0, 3)}
        </Txt>
        <Txt variant="title" color={isToday ? 'accentText' : 'text'}>
          {Number(date.slice(8))}
        </Txt>
      </View>
      <View style={styles.summaryMeals}>
        {slots.map((slot) => {
          const names = dishes
            .filter(({ entry }) => entry.slot_id === slot.id)
            .map((dish) => dish.name);
          return (
            <View key={slot.id}>
              <Txt variant="caption" color="textMuted">
                {slot.name}
              </Txt>
              <Txt variant="label" color={names.length > 0 ? 'text' : 'textMuted'}>
                {names.length > 0 ? names.join(', ') : 'Nothing yet'}
              </Txt>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/** What can be done with one dish. */
export function DishSheet({
  plan,
  slot,
  dish,
  onClose,
}: {
  plan: MealPlan;
  slot: MealSlot | undefined;
  dish: Dish | null;
  onClose: () => void;
}) {
  const { setLocked, clearEntry } = usePlanner();
  const members = useHousehold((state) => state.members);
  const entry = dish?.entry;
  const recipe = dish?.recipe;
  const risky = recipe
    ? planMembers(plan, members).flatMap((member) =>
        allergenHits(recipe, member.allergies).map((hit) => `${member.name}: ${hit.allergy}`),
      )
    : [];

  return (
    <Sheet visible={dish !== null} title={dish?.name ?? ''} onClose={onClose}>
      {dish && entry ? (
        <>
          <View style={styles.sheetMeal}>
            <Txt color="textMuted">
              {weekday(entry.date)} {slot?.name.toLowerCase()}
            </Txt>
            {risky.length > 0 ? (
              <Txt variant="label" color="danger">
                Allergy warning for {risky.join(', ')}
              </Txt>
            ) : null}
          </View>
          <SheetRow
            icon="swap-horizontal"
            title="Swap for another dish"
            onPress={() => {
              onClose();
              router.push({
                pathname: '/planner/pick',
                params: {
                  planId: plan.id,
                  date: entry.date,
                  slotId: entry.slot_id,
                  entryId: entry.id,
                },
              });
            }}
          />
          {recipe ? (
            <SheetRow
              icon="book-open-page-variant-outline"
              title="View recipe"
              onPress={() => {
                onClose();
                router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } });
              }}
            />
          ) : null}
          <SheetRow
            icon={entry.locked ? 'lock-open-variant-outline' : 'lock-outline'}
            title={entry.locked ? 'Unlock' : 'Lock'}
            subtitle={entry.locked ? undefined : 'Regenerating will keep this dish.'}
            onPress={() => {
              onClose();
              void setLocked(entry.id, !entry.locked);
            }}
          />
          <SheetRow
            icon="trash-can-outline"
            title="Remove from this meal"
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    minHeight: TOUCH + 4,
  },
  empty: {
    minHeight: TOUCH,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  summaryDate: { width: 44, alignItems: 'center' },
  summaryMeals: { flex: 1, gap: spacing.sm },
  sheetMeal: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
