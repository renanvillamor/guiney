import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { DateField, Field, PressField, TextField } from '@/components/Fields';
import { FormScreen } from '@/components/Screen';
import { Sheet, SheetRow } from '@/components/Sheet';
import { today } from '@/lib/dates';
import { usePrecooked, useRecipes } from '@/store';
import { messageOf } from '@/store/account';

export default function EditPrecooked() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { meals, add, update, remove } = usePrecooked();
  const recipes = useRecipes((state) => state.recipes);
  const existing = meals.find((meal) => meal.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [recipeId, setRecipeId] = useState(existing?.recipe_id ?? null);
  const [preparedOn, setPreparedOn] = useState<string | null>(existing?.prepared_on ?? today());
  const [expiry, setExpiry] = useState(existing?.expiry_date ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; prepared?: string; expiry?: string }>({});
  const [saving, setSaving] = useState(false);

  const recipe = recipes.find((row) => row.id === recipeId);

  const save = async () => {
    const problems = {
      name: name.trim() === '' ? 'Name this meal.' : undefined,
      prepared: preparedOn ? undefined : 'Pick the day it was cooked.',
      expiry:
        preparedOn && expiry && expiry < preparedOn
          ? 'This is before it was prepared.'
          : undefined,
    };
    setErrors(problems);
    if (problems.name || problems.expiry || !preparedOn) return;

    const draft = {
      name: name.trim(),
      recipe_id: recipe ? recipe.id : null,
      prepared_on: preparedOn,
      expiry_date: expiry,
      notes: notes.trim(),
    };
    setSaving(true);
    try {
      if (existing) await update(existing.id, draft);
      else await add(draft);
      router.back();
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save the meal', messageOf(error));
    }
  };

  return (
    <FormScreen
      title={existing ? 'Edit pre-cooked meal' : 'Add pre-cooked meal'}
      footer={<Button title="Save meal" loading={saving} onPress={() => void save()} style={{ flex: 1 }} />}>
      <Field
        label="From a recipe"
        hint="Guiney needs this to check allergies and diets before planning the meal.">
        <PressField
          label="From a recipe"
          value={recipe?.title ?? null}
          placeholder="Not linked"
          onPress={() => setPicking(true)}
          onClear={() => setRecipeId(null)}
        />
      </Field>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Leftover adobo" error={errors.name} />
      <DateField
        label="Prepared on"
        value={preparedOn}
        onChange={setPreparedOn}
        max={today()}
        error={errors.prepared}
      />
      <DateField label="Expiry date" value={expiry} onChange={setExpiry} optional error={errors.expiry} />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Two portions, top shelf"
        multiline
      />
      {existing ? (
        <Button
          kind="danger"
          icon="trash-can-outline"
          title="Remove meal"
          onPress={() => {
            router.back();
            void remove(existing.id);
          }}
        />
      ) : null}

      <Sheet visible={picking} title="Which recipe?" onClose={() => setPicking(false)}>
        {recipes.map((row) => (
          <SheetRow
            key={row.id}
            title={row.title}
            selected={row.id === recipeId}
            onPress={() => {
              if (name.trim() === '' || name === recipe?.title) setName(row.title);
              setRecipeId(row.id);
              setPicking(false);
            }}
          />
        ))}
      </Sheet>
    </FormScreen>
  );
}
