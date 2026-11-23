import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Fab } from '@/components/Button';
import { Segmented } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { ExpiryBadge } from '@/components/Food';
import { Icon } from '@/components/Icon';
import { TabScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { daysAgo, formatDate, freshness, type Freshness } from '@/lib/dates';
import { formatQuantity } from '@/lib/units';
import { useFridge, usePrecooked, useSettings } from '@/store';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

/** Top shelf is what to use first, like a well-kept fridge. */
const SHELVES: { state: Freshness; title: string }[] = [
  { state: 'expired', title: 'Past its date' },
  { state: 'soon', title: 'Use first' },
  { state: 'fresh', title: 'Fresh' },
  { state: 'none', title: 'No date' },
];

export default function Fridge() {
  const [tab, setTab] = useState<'ingredients' | 'precooked'>('ingredients');
  return (
    <TabScreen title="Fridge">
      <View style={styles.tabs}>
        <Segmented
          options={[
            { value: 'ingredients', label: 'Ingredients' },
            { value: 'precooked', label: 'Pre-cooked meals' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === 'ingredients' ? <Ingredients /> : <Precooked />}
    </TabScreen>
  );
}

function Shelf({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.shelf}>
      <Txt variant="heading" style={styles.shelfTitle}>
        {title}
      </Txt>
      <View style={[styles.shelfBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
      <View style={[styles.lip, { backgroundColor: colors.border }]} />
    </View>
  );
}

function Ingredients() {
  const colors = useColors();
  const items = useFridge((state) => state.items);
  const system = useSettings((state) => state.unitSystem);
  const add = () => router.push('/fridge-item');

  if (items.length === 0) {
    return (
      <ScrollView>
        <EmptyState
          variant="empty-fridge"
          title="Nothing in here yet!"
          body="Add what you have and Guiney will plan around it."
          action={{ title: 'Add ingredient', onPress: add }}
        />
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        {SHELVES.map(({ state, title }) => {
          const onShelf = items.filter((item) => freshness(item.expiry_date) === state);
          if (onShelf.length === 0) return null;
          return (
            <Shelf key={state} title={title}>
              {onShelf.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityHint="Edit or remove"
                  onPress={() => router.push({ pathname: '/fridge-item', params: { id: item.id } })}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      borderTopColor: colors.border,
                      borderTopWidth: index === 0 ? 0 : 1,
                      backgroundColor: pressed ? colors.primaryTint : 'transparent',
                    },
                  ]}>
                  <View style={styles.flex}>
                    <Txt variant="bodyStrong">{item.name}</Txt>
                    <ExpiryBadge date={item.expiry_date} />
                  </View>
                  <Txt color="textMuted">{formatQuantity(item.quantity, item.unit, system)}</Txt>
                </Pressable>
              ))}
            </Shelf>
          );
        })}
      </ScrollView>
      <Fab label="Add ingredient" icon="plus" onPress={add} />
    </>
  );
}

/** Read only. Meals are added and edited on the pre-cooked meals screen. */
function Precooked() {
  const colors = useColors();
  const meals = usePrecooked((state) => state.meals);
  const manage = () => router.push('/precooked');

  if (meals.length === 0) {
    return (
      <ScrollView>
        <EmptyState
          variant="empty-fridge"
          title="Nothing in here yet!"
          body="Cooked extra? Add it and the planner will use it first."
          action={{ title: 'Add pre-cooked meal', onPress: () => router.push('/precooked/edit') }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Shelf title="Oldest first">
        {meals.map((meal, index) => (
          <View
            key={meal.id}
            style={[
              styles.item,
              { borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : 1 },
            ]}>
            <Icon name="pot-mix-outline" color="accentText" />
            <View style={styles.flex}>
              <Txt variant="bodyStrong">{meal.name}</Txt>
              <Txt variant="caption" color="textMuted">
                Prepared {formatDate(meal.prepared_on)}, {daysAgo(meal.prepared_on)}
              </Txt>
              <ExpiryBadge date={meal.expiry_date} />
            </View>
          </View>
        ))}
      </Shelf>
      <Button kind="tint" icon="pencil-outline" title="Manage pre-cooked meals" onPress={manage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.xl },
  shelf: {},
  shelfTitle: { marginBottom: spacing.sm },
  shelfBody: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  /** The glass edge: wider than what stands on it. */
  lip: { height: 8, borderRadius: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
