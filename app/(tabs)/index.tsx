import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Fab, IconButton } from '@/components/Button';
import { Chip, ChipGroup } from '@/components/Choice';
import { AddRecipeSheet } from '@/components/AddRecipe';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Fields';
import { CATEGORY_ICONS, categoryLabel, Meta, RecipePhoto } from '@/components/Food';
import { Icon } from '@/components/Icon';
import { Section, TabScreen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { allergyWarnings } from '@/lib/dietary';
import { normalizeName } from '@/lib/ingredients';
import { useHousehold, useRecipes } from '@/store';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import { CATEGORIES, type Category, type FullRecipe, type Member } from '@/types/models';

interface Filters {
  category: Category | null;
  cuisines: string[];
  tags: string[];
  maxPrep: number | null;
}
const NO_FILTERS: Filters = { category: null, cuisines: [], tags: [], maxPrep: null };
const PREP_LIMITS = [10, 15, 30, 60];

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((other) => other !== value) : [...list, value];

function matches(recipe: FullRecipe, query: string, filters: Filters): boolean {
  const words = normalizeName(query).split(' ').filter(Boolean);
  const text = normalizeName(
    [
      recipe.title,
      recipe.cuisine,
      ...recipe.tags,
      ...recipe.ingredients.map((item) => item.name),
    ].join(' '),
  );
  return (
    words.every((word) => text.includes(word)) &&
    (filters.category === null || recipe.category === filters.category) &&
    (filters.cuisines.length === 0 || filters.cuisines.includes(recipe.cuisine)) &&
    filters.tags.every((tag) => recipe.tags.includes(tag)) &&
    (filters.maxPrep === null || recipe.prep_time_min <= filters.maxPrep)
  );
}

export default function Recipes() {
  const recipes = useRecipes((state) => state.recipes);
  const members = useHousehold((state) => state.members);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState(false);

  const shown = recipes.filter((recipe) => matches(recipe, query, filters));
  const cuisines = [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort();
  const tags = [...new Set(recipes.flatMap((r) => r.tags))].sort();
  const extra = filters.cuisines.length + filters.tags.length + (filters.maxPrep ? 1 : 0);
  const filtering = query.trim() !== '' || extra > 0 || filters.category !== null;

  const reset = () => {
    setQuery('');
    setFilters(NO_FILTERS);
  };

  return (
    <TabScreen title="Recipes">
      {recipes.length > 0 ? (
        <View style={styles.tools}>
          <View style={styles.search}>
            <Input
              label="Search recipes"
              placeholder="Dish or ingredient"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              style={styles.flex}
            />
            <IconButton
              tint
              icon="tune-variant"
              label={extra > 0 ? `Filters, ${extra} on` : 'Filters'}
              badge={extra}
              onPress={() => setSheet(true)}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled">
            {CATEGORIES.filter((category) => recipes.some((r) => r.category === category)).map(
              (category) => (
                <Chip
                  key={category}
                  icon={CATEGORY_ICONS[category]}
                  label={categoryLabel(category)}
                  selected={filters.category === category}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      category: filters.category === category ? null : category,
                    })
                  }
                />
              ),
            )}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={shown}
        keyExtractor={(recipe) => recipe.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RecipeRow recipe={item} members={members} />}
        ListEmptyComponent={
          filtering && recipes.length > 0 ? (
            <EmptyState
              variant="empty-recipes"
              title="No recipe matches"
              body="Try fewer filters or another word."
              action={{ title: 'Clear search and filters', onPress: reset }}
            />
          ) : (
            <EmptyState
              variant="empty-recipes"
              title="Guiney is hungry. Add your first recipe!"
              action={{ title: 'Add a recipe', onPress: () => setAdding(true) }}
            />
          )
        }
      />
      {recipes.length > 0 ? (
        <Fab label="Add a recipe" icon="plus" onPress={() => setAdding(true)} />
      ) : null}

      <AddRecipeSheet visible={adding} onClose={() => setAdding(false)} />
      <Sheet
        visible={sheet}
        title="Filters"
        onClose={() => setSheet(false)}
        footer={
          <>
            <Button kind="tint" title="Clear" onPress={() => setFilters(NO_FILTERS)} style={styles.flex} />
            <Button
              title={`Show ${shown.length}`}
              onPress={() => setSheet(false)}
              style={styles.flex}
            />
          </>
        }>
        <View style={styles.sheet}>
          <Section title="Prep time">
            <ChipGroup>
              {PREP_LIMITS.map((limit) => (
                <Chip
                  key={limit}
                  label={`Up to ${limit} min`}
                  selected={filters.maxPrep === limit}
                  onPress={() =>
                    setFilters({ ...filters, maxPrep: filters.maxPrep === limit ? null : limit })
                  }
                />
              ))}
            </ChipGroup>
          </Section>
          {cuisines.length > 0 ? (
            <Section title="Cuisine">
              <ChipGroup>
                {cuisines.map((cuisine) => (
                  <Chip
                    key={cuisine}
                    multi
                    label={cuisine}
                    selected={filters.cuisines.includes(cuisine)}
                    onPress={() =>
                      setFilters({ ...filters, cuisines: toggle(filters.cuisines, cuisine) })
                    }
                  />
                ))}
              </ChipGroup>
            </Section>
          ) : null}
          {tags.length > 0 ? (
            <Section title="Tags">
              <ChipGroup>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    multi
                    label={tag}
                    selected={filters.tags.includes(tag)}
                    onPress={() => setFilters({ ...filters, tags: toggle(filters.tags, tag) })}
                  />
                ))}
              </ChipGroup>
            </Section>
          ) : null}
        </View>
      </Sheet>
    </TabScreen>
  );
}

function RecipeRow({ recipe, members }: { recipe: FullRecipe; members: Member[] }) {
  const colors = useColors();
  const warnings = allergyWarnings(recipe, members);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.primaryTint : colors.surface,
          borderColor: colors.border,
        },
      ]}>
      <RecipePhoto uri={recipe.photo_uri} category={recipe.category} width={92} height={92} />
      <View style={styles.text}>
        <Txt variant="subheading" numberOfLines={2}>
          {recipe.title}
        </Txt>
        <View style={styles.meta}>
          <Meta icon="clock-outline" text={`${recipe.prep_time_min + recipe.cook_time_min} min`} />
          <Meta icon="account-multiple-outline" text={`Serves ${recipe.servings}`} />
        </View>
        {warnings.length > 0 ? (
          <View style={styles.warning}>
            <Icon name="alert" size={16} color="danger" />
            <Txt variant="label" color="danger" style={styles.flex} numberOfLines={1}>
              Not safe for {warnings.map((warning) => warning.member.name).join(', ')}
            </Txt>
          </View>
        ) : recipe.cuisine ? (
          <Txt variant="caption" color="textMuted">
            {recipe.cuisine}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tools: { gap: spacing.md, paddingBottom: spacing.md },
  search: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheet: { paddingHorizontal: spacing.md, gap: spacing.lg },
});
