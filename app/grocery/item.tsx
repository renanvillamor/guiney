import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Field, QuantityInput, TextField } from '@/components/Fields';
import { FormScreen } from '@/components/Screen';
import { editableNumber, parseQuantity, toBase, toDisplay, type InputUnit } from '@/lib/units';
import { useGrocery, useSettings } from '@/store';
import { messageOf } from '@/store/account';

export default function GroceryItemScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, add, update, remove } = useGrocery();
  const system = useSettings((state) => state.unitSystem);
  const existing = items.find((item) => item.id === id);
  const shown =
    existing && existing.quantity !== null
      ? toDisplay(existing.quantity, existing.unit, system)
      : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(shown ? editableNumber(shown.quantity) : '');
  const [unit, setUnit] = useState<InputUnit>(shown?.unit ?? 'piece');
  const [errors, setErrors] = useState<{ name?: string; quantity?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amount = parseQuantity(quantity);
    const problems = {
      name: name.trim() === '' ? 'Name this item.' : undefined,
      quantity:
        quantity.trim() !== '' && amount === null ? 'Use a number like 2, 1.5 or 1/2.' : undefined,
    };
    setErrors(problems);
    if (problems.name || problems.quantity) return;
    const base = toBase(amount ?? 1, unit);
    const draft = { name: name.trim(), quantity: amount === null ? null : base.quantity, unit: base.unit };
    setSaving(true);
    try {
      if (existing) await update(existing.id, draft);
      else await add(draft);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save the item', messageOf(error));
    }
  };

  return (
    <FormScreen
      title={existing ? 'Edit item' : 'Add item'}
      footer={<Button title="Save item" loading={saving} onPress={() => void save()} style={{ flex: 1 }} />}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Rice" error={errors.name} />
      <Field label="Amount" error={errors.quantity}>
        <QuantityInput quantity={quantity} unit={unit} onQuantity={setQuantity} onUnit={setUnit} />
      </Field>
      {existing ? (
        <Button
          kind="danger"
          icon="trash-can-outline"
          title="Remove from list"
          onPress={() => {
            router.back();
            void remove(existing.id);
          }}
        />
      ) : null}
    </FormScreen>
  );
}
