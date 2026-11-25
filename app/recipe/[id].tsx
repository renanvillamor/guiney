import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { AllergyBanner, categoryLabel, Meta, RecipePhoto } from '@/components/Food';
import { Icon } from '@/components/Icon';
import { Section } from '@/components/Screen';
import { Sheet, SheetRow } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { allergyWarnings, dietConflict, dietLabel } from '@/lib/dietary';
import { sameIngredient } from '@/lib/ingredients';
import { siteName } from '@/lib/recipeImport';
import { formatQuantity } from '@/lib/units';
import { useFridge, useHousehold, useRecipes, useSettings } from '@/store';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

async function openSource(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open the page', url);
  }
}

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recipes, duplicate, remove } = useRecipes();
  const members = useHousehold((state) => state.members);
  const fridge = useFridge((state) => state.items);
  const system = useSettings((state) => state.unitSystem);
  const [menu, setMenu] = useState(false);

  const recipe = recipes.find((row) => row.id === id);
  if (!recipe) {
    return (
      <EmptyState
        variant="empty-recipes"
        title="This recipe is gone"
        body="Someone in your household may have deleted it."
        action={{ title: 'Back to recipes', onPress: () => router.dismissTo('/') }}
      />
    );
  }

  const original = recipes.find((row) => row.id === recipe.copied_from_recipe_id);
  const warnings = allergyWarnings(recipe, members);
  const diets = members.flatMap((member) => {
    const reason = dietConflict(recipe, member.diet);
    return reason ? [`${member.name} is ${dietLabel(member.diet).toLowerCase()} (${reason})`] : [];
  });

  const copy = async () => {
    setMenu(false);
    const copyId = await duplicate(recipe.id);
    router.push({ pathname: '/recipe/[id]', params: { id: copyId } });
    router.push({ pathname: '/recipe/edit', params: { id: copyId } });
  };
  const confirmDelete = () => {
    setMenu(false);
    Alert.alert('Delete this recipe?', `${recipe.title} will also be taken out of your meal plans.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          void remove(recipe.id);
        },
      },
    ]);
  };

  const nutrition = [
    ['Calories', recipe.calories, ''],
    ['Protein', recipe.protein_g, ' g'],
    ['Carbs', recipe.carbs_g, ' g'],
    ['Fat', recipe.fat_g, ' g'],
  ] as const;
  const hasNutrition = nutrition.some(([, value]) => value !== null);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton icon="dots-vertical" label="More actions" onPress={() => setMenu(true)} />
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <RecipePhoto
          uri={recipe.photo_uri}
          category={recipe.category}
          width="100%"
          height={recipe.photo_uri ? 240 : 140}
          rounded={radius.lg}
        />
        <View style={styles.intro}>
          <Txt variant="hero">{recipe.title}</Txt>
          {recipe.copied_from_recipe_id ? (
            <Pressable
              accessibilityRole={original ? 'link' : undefined}
              disabled={!original}
              onPress={() =>
                original &&
                router.push({ pathname: '/recipe/[id]', params: { id: original.id } })
              }
              style={styles.based}>
              <Icon name="content-copy" size={16} color={original ? 'accentText' : 'textMuted'} />
              <Txt variant="label" color={original ? 'accentText' : 'textMuted'}>
                {original ? `Based on ${original.title}` : 'Based on a recipe that was deleted'}
              </Txt>
            </Pressable>
          ) : null}
          {recipe.source_url ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void openSource(recipe.source_url!)}
              style={styles.based}>
              <Icon name="web" size={16} color="accentText" />
              <Txt variant="label" color="accentText">
                From {siteName(recipe.source_url)}
              </Txt>
            </Pressable>
          ) : null}
          {recipe.description ? <Txt color="textMuted">{recipe.description}</Txt> : null}
          <View style={styles.meta}>
            <Meta icon="knife" text={`Prep ${recipe.prep_time_min} min`} />
            <Meta icon="pot-steam-outline" text={`Cook ${recipe.cook_time_min} min`} />
            <Meta icon="account-multiple-outline" text={`Serves ${recipe.servings}`} />
          </View>
          <View style={styles.tags}>
            {[categoryLabel(recipe.category), recipe.cuisine, ...recipe.tags]
              .filter(Boolean)
              .map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.primaryTint }]}>
                  <Txt variant="label">{tag}</Txt>
                </View>
              ))}
          </View>
        </View>

        <AllergyBanner warnings={warnings} />
        {diets.length > 0 ? (
          <View style={styles.diet}>
            <Icon name="alert-circle-outline" size={20} color="accentText" />
            <Txt style={styles.flex}>{diets.join('. ')}.</Txt>
          </View>
        ) : null}

        <Section title="Ingredients">
          {recipe.ingredients.length === 0 ? (
            <Txt color="textMuted">None written down yet.</Txt>
          ) : (
            <View>
              {recipe.ingredients.map((item) => {
                const inFridge = fridge.some((stock) => sameIngredient(stock.name, item.name));
                return (
                  <View key={item.id} style={[styles.line, { borderBottomColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Txt>
                        {item.name}
                        {item.note ? <Txt color="textMuted">, {item.note}</Txt> : null}
                      </Txt>
                      {inFridge ? (
                        <View style={styles.have}>
                          <Icon name="fridge-outline" size={14} color="secondary" />
                          <Txt variant="caption" color="secondary">
                            In the fridge
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                    <Txt variant="bodyStrong">
                      {formatQuantity(item.quantity, item.unit, system) || 'To taste'}
                    </Txt>
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        <Section title="Steps">
          {recipe.steps.length === 0 ? (
            <Txt color="textMuted">None written down yet.</Txt>
          ) : (
            recipe.steps.map((step, index) => (
              <View key={step.id} style={styles.step}>
                <View style={[styles.number, { backgroundColor: colors.fill }]}>
                  <Txt variant="button" color="onFill">
                    {index + 1}
                  </Txt>
                </View>
                <Txt style={styles.flex}>{step.instruction}</Txt>
              </View>
            ))
          )}
        </Section>

        {hasNutrition ? (
          <Section title="Nutrition per serving">
            <View style={[styles.nutrition, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {nutrition.map(([label, value, unit]) => (
                <View key={label} style={styles.nutrient}>
                  <Txt variant="subheading">{value === null ? 'n/a' : `${Math.round(value)}${unit}`}</Txt>
                  <Txt variant="caption" color="textMuted">
                    {label}
                  </Txt>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Button
          kind="tint"
          icon="content-copy"
          title="Duplicate and customize"
          onPress={() => void copy()}
        />
      </ScrollView>

      <Sheet visible={menu} title={recipe.title} onClose={() => setMenu(false)}>
        <SheetRow
          icon="pencil-outline"
          title="Edit"
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/recipe/edit', params: { id: recipe.id } });
          }}
        />
        <SheetRow icon="content-copy" title="Duplicate" onPress={() => void copy()} />
        <SheetRow icon="trash-can-outline" title="Delete" danger onPress={confirmDelete} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { gap: spacing.sm },
  based: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  tag: { borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  diet: { flexDirection: 'row', gap: spacing.sm },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  have: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { flexDirection: 'row', gap: spacing.md },
  number: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutrition: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.lg, paddingVertical: spacing.md },
  nutrient: { flex: 1, alignItems: 'center' },
});
