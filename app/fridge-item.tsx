import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { DateField, Field, QuantityInput, TextField } from '@/components/Fields';
import { FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { editableNumber, parseQuantity, toBase, toDisplay, type InputUnit } from '@/lib/units';
import { useFridge, useSettings } from '@/store';
import { messageOf } from '@/store/account';

export default function FridgeItemScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, add, update, remove } = useFridge();
  const system = useSettings((state) => state.unitSystem);
  const existing = items.find((item) => item.id === id);
  const shown =
    existing && existing.quantity !== null
      ? toDisplay(existing.quantity, existing.unit, system)
      : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [quantity, setQuantity] = useState(shown ? editableNumber(shown.quantity) : '');
  const [unit, setUnit] = useState<InputUnit>(
    shown?.unit ?? (existing ? existing.unit : system === 'metric' ? 'g' : 'piece'),
  );
  const [expiry, setExpiry] = useState(existing?.expiry_date ?? null);
  const [errors, setErrors] = useState<{ name?: string; quantity?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amount = parseQuantity(quantity);
    const problems = {
      name: name.trim() === '' ? 'Name this ingredient.' : undefined,
      quantity:
        quantity.trim() !== '' && amount === null ? 'Use a number like 2, 1.5 or 1/2.' : undefined,
    };
    setErrors(problems);
    if (problems.name || problems.quantity) return;

    const base = toBase(amount ?? 1, unit);
    const draft = {
      name: name.trim(),
      quantity: amount === null ? null : base.quantity,
      unit: base.unit,
      expiry_date: expiry,
    };
    setSaving(true);
    try {
      if (existing) await update(existing.id, draft);
      else await add(draft);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save', messageOf(error));
    }
  };

  return (
    <FormScreen
      title={existing ? 'Edit ingredient' : 'Add ingredient'}
      footer={<Button title="Save ingredient" loading={saving} onPress={() => void save()} style={{ flex: 1 }} />}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Chicken thighs" error={errors.name} />
      <Field label="Amount" error={errors.quantity} hint="Leave blank if you are not sure.">
        <QuantityInput quantity={quantity} unit={unit} onQuantity={setQuantity} onUnit={setUnit} />
      </Field>
      <DateField label="Expiry date" value={expiry} onChange={setExpiry} optional />
      {existing ? (
        <>
          <Txt variant="caption" color="textMuted">
            {existing.source === 'grocery' ? 'Came from the grocery list.' : 'Added by hand.'}
          </Txt>
          <Button
            kind="danger"
            icon="trash-can-outline"
            title="Remove from fridge"
            onPress={() => {
              router.back();
              void remove(existing.id);
            }}
          />
        </>
      ) : null}
    </FormScreen>
  );
}
