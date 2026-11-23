import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Chip, ChipGroup, TagInput } from '@/components/Choice';
import { Field, Input, QuantityInput, TextField } from '@/components/Fields';
import { CATEGORY_ICONS, categoryLabel, RecipePhoto } from '@/components/Food';
import { Card, FormScreen, Section } from '@/components/Screen';
import { Sheet, SheetRow } from '@/components/Sheet';
import { Txt } from '@/components/Txt';
import { pickPhoto } from '@/lib/photos';
import { editableNumber, parseQuantity, toBase, toDisplay, unitsForSystem, type InputUnit } from '@/lib/units';
import { useRecipes, useSettings } from '@/store';
import { messageOf } from '@/store/account';
import { radius, spacing } from '@/theme/spacing';
import { CATEGORIES, type Category, type UnitSystem } from '@/types/models';

interface Line {
  key: number;
  name: string;
  quantity: string;
  unit: InputUnit;
  note: string;
}
interface Step {
  key: number;
  text: string;
}

/** Blank is fine and means "not set"; anything else must be a whole or decimal number. */
function readNumber(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : 'invalid';
}

const asText = (value: number | null) => (value === null ? '' : String(value));

export default function EditRecipe() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { recipes, add, update } = useRecipes();
  const system: UnitSystem = useSettings((state) => state.unitSystem);
  const existing = recipes.find((row) => row.id === id);

  const nextKey = useRef(1000);
  const newKey = () => (nextKey.current += 1);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photo, setPhoto] = useState(existing?.photo_uri ?? null);
  const [prep, setPrep] = useState(existing ? String(existing.prep_time_min) : '');
  const [cook, setCook] = useState(existing ? String(existing.cook_time_min) : '');
  const [servings, setServings] = useState(existing ? String(existing.servings) : '4');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'dinner');
  const [cuisine, setCuisine] = useState(existing?.cuisine ?? '');
  const [tags, setTags] = useState(existing?.tags ?? []);
  const [nutrition, setNutrition] = useState({
    calories: asText(existing?.calories ?? null),
    protein_g: asText(existing?.protein_g ?? null),
    carbs_g: asText(existing?.carbs_g ?? null),
    fat_g: asText(existing?.fat_g ?? null),
  });
  const [lines, setLines] = useState<Line[]>(() =>
    (existing?.ingredients ?? []).map((item, key) => {
      const shown = item.quantity === null ? null : toDisplay(item.quantity, item.unit, system);
      return {
        key,
        name: item.name,
        quantity: shown ? editableNumber(shown.quantity) : '',
        unit: shown?.unit ?? unitsForSystem(system).find((unit) => toBase(1, unit).unit === item.unit) ?? 'piece',
        note: item.note,
      };
    }),
  );
  const [steps, setSteps] = useState<Step[]>(() =>
    (existing?.steps ?? []).map((step, key) => ({ key, text: step.instruction })),
  );
  const [photoSheet, setPhotoSheet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setLine = (key: number, changes: Partial<Line>) =>
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  const moveStep = (index: number, by: number) =>
    setSteps((all) => {
      const next = [...all];
      const [step] = next.splice(index, 1);
      if (step) next.splice(index + by, 0, step);
      return next;
    });

  const choosePhoto = async (from: 'camera' | 'gallery') => {
    setPhotoSheet(false);
    try {
      const result = await pickPhoto(from);
      if (result.status === 'picked') setPhoto(result.uri);
      if (result.status === 'denied') {
        Alert.alert('Camera is off', 'Allow camera access for Guiney in Android settings, or pick a photo instead.');
      }
    } catch (error) {
      Alert.alert('Could not add the photo', messageOf(error));
    }
  };

  const save = async () => {
    const problems: Record<string, string> = {};
    if (title.trim() === '') problems.title = 'Give the recipe a name.';

    const numbers = {
      prep: readNumber(prep),
      cook: readNumber(cook),
      servings: readNumber(servings),
      calories: readNumber(nutrition.calories),
      protein_g: readNumber(nutrition.protein_g),
      carbs_g: readNumber(nutrition.carbs_g),
      fat_g: readNumber(nutrition.fat_g),
    };
    for (const [field, value] of Object.entries(numbers)) {
      if (value === 'invalid') problems[field] = 'Use a number.';
    }
    if (typeof numbers.servings !== 'number' || numbers.servings < 1) {
      problems.servings = 'At least 1.';
    }

    const filled = lines.filter((line) => line.name.trim() || line.quantity.trim());
    for (const line of filled) {
      if (!line.name.trim()) problems[`line-${line.key}`] = 'Name this ingredient.';
      else if (line.quantity.trim() && parseQuantity(line.quantity) === null) {
        problems[`line-${line.key}`] = 'Use a number like 2, 1.5 or 1/2.';
      }
    }
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const number = (value: number | null | 'invalid') => (typeof value === 'number' ? value : null);
    const draft = {
      title: title.trim(),
      description: description.trim(),
      photo_uri: photo,
      prep_time_min: Math.round(number(numbers.prep) ?? 0),
      cook_time_min: Math.round(number(numbers.cook) ?? 0),
      servings: Math.round(number(numbers.servings) ?? 1),
      tags,
      category,
      cuisine: cuisine.trim(),
      calories: number(numbers.calories),
      protein_g: number(numbers.protein_g),
      carbs_g: number(numbers.carbs_g),
      fat_g: number(numbers.fat_g),
      copied_from_recipe_id: existing?.copied_from_recipe_id ?? null,
      ingredients: filled.map((line) => {
        const amount = parseQuantity(line.quantity);
        const base = toBase(amount ?? 1, line.unit);
        return {
          name: line.name.trim(),
          quantity: amount === null ? null : base.quantity,
          unit: base.unit,
          note: line.note.trim(),
        };
      }),
      steps: steps.map((step) => step.text.trim()).filter((text) => text !== ''),
    };

    setSaving(true);
    try {
      if (existing) {
        await update(existing.id, draft);
        router.back();
      } else {
        const newId = await add(draft);
        router.replace({ pathname: '/recipe/[id]', params: { id: newId } });
      }
    } catch (error) {
      setSaving(false);
      Alert.alert('Could not save the recipe', messageOf(error));
    }
  };

  return (
    <FormScreen
      title={existing ? 'Edit recipe' : 'New recipe'}
      footer={
        <View style={styles.flex}>
          {Object.keys(errors).length > 0 ? (
            <Txt variant="label" color="danger" style={styles.summary} accessibilityLiveRegion="polite">
              Check the fields marked in red.
            </Txt>
          ) : null}
          <Button title="Save recipe" loading={saving} onPress={() => void save()} />
        </View>
      }>
      <View style={styles.photo}>
        <RecipePhoto uri={photo} category={category} width="100%" height={180} rounded={radius.lg} />
        <Button
          kind="tint"
          icon="camera-outline"
          title={photo ? 'Change photo' : 'Add a photo'}
          onPress={() => setPhotoSheet(true)}
        />
      </View>

      <TextField label="Name" value={title} onChangeText={setTitle} placeholder="Lola's pancit" error={errors.title} />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What makes it good?"
        multiline
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label="Prep (min)" value={prep} onChangeText={setPrep} keyboardType="number-pad" placeholder="0" error={errors.prep} />
        </View>
        <View style={styles.flex}>
          <TextField label="Cook (min)" value={cook} onChangeText={setCook} keyboardType="number-pad" placeholder="0" error={errors.cook} />
        </View>
        <View style={styles.flex}>
          <TextField label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" error={errors.servings} />
        </View>
      </View>

      <Field label="Category" hint="The planner uses this to match recipes to meals.">
        <ChipGroup>
          {CATEGORIES.map((option) => (
            <Chip
              key={option}
              icon={CATEGORY_ICONS[option]}
              label={categoryLabel(option)}
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </ChipGroup>
      </Field>
      <TextField label="Cuisine" value={cuisine} onChangeText={setCuisine} placeholder="Filipino" />
      <TagInput label="Tags" placeholder="quick, party" values={tags} onChange={setTags} />

      <Section title="Ingredients" hint="Leave the amount blank for “to taste”.">
        {lines.map((line, index) => (
          <Card key={line.key}>
            <View style={styles.row}>
              <Input
                label={`Ingredient ${index + 1}`}
                value={line.name}
                onChangeText={(name) => setLine(line.key, { name })}
                placeholder="Ingredient"
                invalid={!!errors[`line-${line.key}`]}
                style={styles.flex}
              />
              <IconButton
                icon="trash-can-outline"
                color="danger"
                label={`Remove ${line.name || `ingredient ${index + 1}`}`}
                onPress={() => setLines((all) => all.filter((other) => other.key !== line.key))}
              />
            </View>
            <QuantityInput
              label={`Amount of ${line.name || `ingredient ${index + 1}`}`}
              quantity={line.quantity}
              unit={line.unit}
              onQuantity={(quantity) => setLine(line.key, { quantity })}
              onUnit={(unit) => setLine(line.key, { unit })}
            />
            <Input
              label={`Note for ${line.name || `ingredient ${index + 1}`}`}
              value={line.note}
              onChangeText={(note) => setLine(line.key, { note })}
              placeholder="Note, like “finely chopped”"
            />
            {errors[`line-${line.key}`] ? (
              <Txt variant="caption" color="danger">
                {errors[`line-${line.key}`]}
              </Txt>
            ) : null}
          </Card>
        ))}
        <Button
          kind="tint"
          icon="plus"
          title="Add ingredient"
          onPress={() =>
            setLines((all) => [
              ...all,
              { key: newKey(), name: '', quantity: '', unit: system === 'metric' ? 'g' : 'cup', note: '' },
            ])
          }
        />
      </Section>

      <Section title="Steps">
        {steps.map((step, index) => (
          <View key={step.key} style={styles.step}>
            <Txt variant="heading" color="accentText" style={styles.stepNumber}>
              {index + 1}
            </Txt>
            <View style={styles.flex}>
              <Input
                label={`Step ${index + 1}`}
                value={step.text}
                onChangeText={(text) =>
                  setSteps((all) =>
                    all.map((other) => (other.key === step.key ? { ...other, text } : other)),
                  )
                }
                placeholder="What happens next?"
                multiline
              />
              <View style={styles.stepTools}>
                <IconButton icon="arrow-up" size={20} label={`Move step ${index + 1} up`} disabled={index === 0} onPress={() => moveStep(index, -1)} />
                <IconButton icon="arrow-down" size={20} label={`Move step ${index + 1} down`} disabled={index === steps.length - 1} onPress={() => moveStep(index, 1)} />
                <IconButton icon="trash-can-outline" size={20} color="danger" label={`Remove step ${index + 1}`} onPress={() => setSteps((all) => all.filter((other) => other.key !== step.key))} />
              </View>
            </View>
          </View>
        ))}
        <Button kind="tint" icon="plus" title="Add step" onPress={() => setSteps((all) => [...all, { key: newKey(), text: '' }])} />
      </Section>

      <Section title="Nutrition per serving" hint="Optional. Keto plans rely on carbs.">
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Calories" keyboardType="decimal-pad" value={nutrition.calories} onChangeText={(calories) => setNutrition({ ...nutrition, calories })} error={errors.calories} />
          </View>
          <View style={styles.flex}>
            <TextField label="Protein (g)" keyboardType="decimal-pad" value={nutrition.protein_g} onChangeText={(protein_g) => setNutrition({ ...nutrition, protein_g })} error={errors.protein_g} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Carbs (g)" keyboardType="decimal-pad" value={nutrition.carbs_g} onChangeText={(carbs_g) => setNutrition({ ...nutrition, carbs_g })} error={errors.carbs_g} />
          </View>
          <View style={styles.flex}>
            <TextField label="Fat (g)" keyboardType="decimal-pad" value={nutrition.fat_g} onChangeText={(fat_g) => setNutrition({ ...nutrition, fat_g })} error={errors.fat_g} />
          </View>
        </View>
      </Section>

      <Sheet visible={photoSheet} title="Recipe photo" onClose={() => setPhotoSheet(false)}>
        <SheetRow icon="camera-outline" title="Take a photo" onPress={() => void choosePhoto('camera')} />
        <SheetRow icon="image-outline" title="Choose from gallery" onPress={() => void choosePhoto('gallery')} />
        {photo ? (
          <SheetRow
            icon="trash-can-outline"
            danger
            title="Remove photo"
            onPress={() => {
              setPhoto(null);
              setPhotoSheet(false);
            }}
          />
        ) : null}
      </Sheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photo: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNumber: { width: 24, textAlign: 'center', paddingTop: spacing.sm + 2 },
  stepTools: { flexDirection: 'row', justifyContent: 'flex-end' },
  summary: { marginBottom: spacing.sm },
});
