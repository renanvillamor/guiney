import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { categoryLabel } from '@/components/Food';
import { Input } from '@/components/Fields';
import { Card, FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { categoriesForSlot } from '@/lib/planner';
import { usePlanner } from '@/store';
import { spacing } from '@/theme/spacing';
import type { MealSlot } from '@/types/models';

const MAX_DISHES = 5;

export default function Slots() {
  const { slots, addSlot, reorderSlots } = usePlanner();
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    setName('');
    void addSlot(trimmed);
  };
  const move = (index: number, by: number) => {
    const ids = slots.map((slot) => slot.id);
    const [id] = ids.splice(index, 1);
    if (id) ids.splice(index + by, 0, id);
    void reorderSlots(ids);
  };

  return (
    <FormScreen title="Meal slots">
      <Txt color="textMuted">
        The name tells Guiney what fits. A slot called Merienda gets snacks; one called Baon gets
        lunches. Guiney plans this many dishes, and you can always add more to a meal.
      </Txt>
      {slots.map((slot, index) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          onUp={index > 0 ? () => move(index, -1) : undefined}
          onDown={index < slots.length - 1 ? () => move(index, 1) : undefined}
        />
      ))}
      <View style={styles.row}>
        <Input
          label="New slot name"
          placeholder="Merienda"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          style={styles.flex}
        />
        <Button kind="tint" icon="plus" title="Add" onPress={add} disabled={name.trim() === ''} />
      </View>
    </FormScreen>
  );
}

function SlotCard({
  slot,
  onUp,
  onDown,
}: {
  slot: MealSlot;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const { renameSlot, removeSlot, setSlotDishes } = usePlanner();
  const [name, setName] = useState(slot.name);

  const rename = () => {
    const trimmed = name.trim();
    if (trimmed === '') setName(slot.name);
    else if (trimmed !== slot.name) void renameSlot(slot.id, trimmed);
  };
  const confirmRemove = () =>
    Alert.alert(`Remove ${slot.name}?`, 'Meals planned in this slot will be removed too.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeSlot(slot.id) },
    ]);

  return (
    <Card>
      <View style={styles.row}>
        <Input label="Slot name" value={name} onChangeText={setName} onBlur={rename} onSubmitEditing={rename} style={styles.flex} />
        <IconButton icon="arrow-up" label={`Move ${slot.name} up`} disabled={!onUp} onPress={() => onUp?.()} />
        <IconButton icon="arrow-down" label={`Move ${slot.name} down`} disabled={!onDown} onPress={() => onDown?.()} />
        <IconButton icon="trash-can-outline" color="danger" label={`Remove ${slot.name}`} onPress={confirmRemove} />
      </View>
      <Txt variant="caption" color="textMuted">
        Takes {categoriesForSlot(name).map(categoryLabel).join(', ')}
      </Txt>
      <View style={styles.row}>
        <Txt variant="label" style={styles.flex}>
          Dishes per meal
        </Txt>
        <IconButton
          icon="minus"
          label={`Fewer dishes for ${slot.name}`}
          disabled={slot.dishes <= 1}
          onPress={() => void setSlotDishes(slot.id, slot.dishes - 1)}
        />
        <Txt variant="bodyStrong" center style={styles.count} accessibilityLabel={`${slot.dishes} dishes`}>
          {slot.dishes}
        </Txt>
        <IconButton
          icon="plus"
          label={`More dishes for ${slot.name}`}
          disabled={slot.dishes >= MAX_DISHES}
          onPress={() => void setSlotDishes(slot.id, slot.dishes + 1)}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  count: { minWidth: 24 },
});
