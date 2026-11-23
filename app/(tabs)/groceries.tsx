import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { TabScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { groceryListText } from '@/lib/grocery';
import { formatQuantity } from '@/lib/units';
import { useGrocery, usePlanner, useSettings } from '@/store';
import { messageOf } from '@/store/account';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import type { GroceryItem } from '@/types/models';

export default function Groceries() {
  const colors = useColors();
  const { items, add } = useGrocery();
  const plans = usePlanner((state) => state.plans);
  const system = useSettings((state) => state.unitSystem);
  const [name, setName] = useState('');

  const toBuy = items.filter((item) => !item.is_bought);
  const bought = items.filter((item) => item.is_bought);

  const quickAdd = () => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setName('');
    void add({ name: trimmed, quantity: null, unit: 'piece' });
  };
  const share = async () => {
    try {
      await Share.share({ message: groceryListText(items, system) }, { dialogTitle: 'Share grocery list' });
    } catch (error) {
      Alert.alert('Could not share the list', messageOf(error));
    }
  };

  return (
    <TabScreen
      title="Groceries"
      actions={
        <>
          <IconButton
            icon="share-variant-outline"
            label="Share list"
            disabled={toBuy.length === 0}
            onPress={() => void share()}
          />
          <IconButton
            icon="basket-plus-outline"
            label="Make list from plan"
            color="accentText"
            onPress={() => router.push('/grocery/generate')}
          />
        </>
      }>
      <View style={styles.add}>
        <Input
          label="Add an item"
          placeholder="Add an item"
          value={name}
          onChangeText={setName}
          onSubmitEditing={quickAdd}
          submitBehavior="submit"
          returnKeyType="done"
          style={styles.flex}
        />
        {name.trim() === '' ? (
          <Button
            kind="tint"
            title="With amount"
            onPress={() => router.push('/grocery/item')}
          />
        ) : (
          <Button kind="tint" icon="plus" title="Add" onPress={quickAdd} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {items.length === 0 ? (
          <EmptyState
            variant="empty-groceries"
            title="All stocked up!"
            body={
              plans.length > 0
                ? 'Make a list from your plan, or add items above.'
                : 'Plan some meals and Guiney will write the list.'
            }
            action={
              plans.length > 0
                ? { title: 'Make list from plan', onPress: () => router.push('/grocery/generate') }
                : { title: 'Plan meals', onPress: () => router.push('/planner/new') }
            }
          />
        ) : null}

        {toBuy.length > 0 ? (
          <View>
            <Txt variant="heading" style={styles.heading}>
              {toBuy.length === 1 ? '1 thing to buy' : `${toBuy.length} things to buy`}
            </Txt>
            <View style={[styles.paper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {toBuy.map((item, index) => (
                <Row key={item.id} item={item} first={index === 0} />
              ))}
            </View>
          </View>
        ) : null}

        {bought.length > 0 ? (
          <View>
            <Txt variant="heading" style={styles.heading}>
              In the bag
            </Txt>
            <View style={[styles.paper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {bought.map((item, index) => (
                <Row key={item.id} item={item} first={index === 0} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {bought.length > 0 ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Button
            icon="fridge-outline"
            title={`Move ${bought.length} bought ${bought.length === 1 ? 'item' : 'items'} to fridge`}
            onPress={() => router.push('/grocery/move')}
          />
        </View>
      ) : null}
    </TabScreen>
  );
}

function Row({ item, first }: { item: GroceryItem; first: boolean }) {
  const colors = useColors();
  const system = useSettings((state) => state.unitSystem);
  const setBought = useGrocery((state) => state.setBought);
  const amount = formatQuantity(item.quantity, item.unit, system);
  return (
    <View
      style={[styles.row, { borderTopColor: colors.border, borderTopWidth: first ? 0 : 1 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_bought }}
        accessibilityLabel={amount ? `${item.name}, ${amount}` : item.name}
        onPress={() => void setBought(item.id, !item.is_bought)}
        style={({ pressed }) => [
          styles.check,
          { backgroundColor: pressed ? colors.primaryTint : 'transparent' },
        ]}>
        <View
          style={[
            styles.box,
            {
              borderColor: item.is_bought ? colors.secondary : colors.textMuted,
              backgroundColor: item.is_bought ? colors.secondary : 'transparent',
            },
          ]}>
          {item.is_bought ? <Icon name="check" size={18} color="onSecondary" /> : null}
        </View>
        <View style={styles.flex}>
          <Txt
            variant="bodyStrong"
            color={item.is_bought ? 'textMuted' : 'text'}
            style={item.is_bought ? styles.struck : null}>
            {item.name}
          </Txt>
          {item.source === 'manual' ? (
            <Txt variant="caption" color="textMuted">
              Added by hand
            </Txt>
          ) : null}
        </View>
        <Txt color={item.is_bought ? 'textMuted' : 'text'}>{amount}</Txt>
      </Pressable>
      <IconButton
        icon="pencil-outline"
        size={20}
        color="textMuted"
        label={`Edit ${item.name}`}
        onPress={() => router.push({ pathname: '/grocery/item', params: { id: item.id } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  add: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  heading: { marginBottom: spacing.sm },
  paper: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  check: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  struck: { textDecorationLine: 'line-through' },
  footer: { padding: spacing.md, paddingHorizontal: spacing.lg, borderTopWidth: 1 },
});
