import { router, Stack } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Fab } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ExpiryBadge } from '@/components/Food';
import { Card, LinkRow } from '@/components/Screen';
import { daysAgo, formatDate } from '@/lib/dates';
import { usePrecooked, useRecipes } from '@/store';
import { spacing } from '@/theme/spacing';

export default function PrecookedMeals() {
  const meals = usePrecooked((state) => state.meals);
  const recipes = useRecipes((state) => state.recipes);
  const add = () => router.push('/precooked/edit');

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Pre-cooked meals' }} />
      <FlatList
        data={meals}
        keyExtractor={(meal) => meal.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const recipe = recipes.find((row) => row.id === item.recipe_id);
          return (
            <Card padded={false}>
              <LinkRow
                last
                title={item.name}
                subtitle={[
                  `Prepared ${formatDate(item.prepared_on)}, ${daysAgo(item.prepared_on)}`,
                  recipe && recipe.title !== item.name ? `From ${recipe.title}` : null,
                  item.notes || null,
                ]
                  .filter(Boolean)
                  .join('\n')}
                onPress={() => router.push({ pathname: '/precooked/edit', params: { id: item.id } })}
              />
              {item.expiry_date ? (
                <View style={styles.badge}>
                  <ExpiryBadge date={item.expiry_date} />
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            variant="empty-fridge"
            title="Nothing in here yet!"
            body="Cooked extra? Add it and the planner will use it first."
            action={{ title: 'Add pre-cooked meal', onPress: add }}
          />
        }
      />
      {meals.length > 0 ? <Fab label="Add meal" icon="plus" onPress={add} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 104, gap: spacing.md },
  badge: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
