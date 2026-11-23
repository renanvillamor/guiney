import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipGroup, TagInput } from '@/components/Choice';
import { Field, TextField } from '@/components/Fields';
import { FormScreen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { ALLERGENS, dietLabel } from '@/lib/dietary';
import { useHousehold } from '@/store';
import { messageOf, useAccount } from '@/store/account';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import { DIETS, type Diet } from '@/types/models';

const AVATARS = ['👩‍🍳', '👨‍🍳', '🧑‍🌾', '👵', '👴', '👩', '👨', '🧑', '👧', '👦', '👶', '🐹'];
const COMMON: readonly string[] = ALLERGENS;

export default function EditMember() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const { members, add, update, link, remove } = useHousehold();
  const session = useAccount((state) => state.session);
  const existing = members.find((member) => member.id === id);

  const [name, setName] = useState(existing?.name ?? '');
  const [avatar, setAvatar] = useState(existing?.avatar ?? AVATARS[0]!);
  const [diet, setDiet] = useState<Diet>(existing?.diet ?? 'none');
  const [allergies, setAllergies] = useState(existing?.allergies ?? []);
  const [liked, setLiked] = useState(existing?.liked_ingredients ?? []);
  const [disliked, setDisliked] = useState(existing?.disliked_ingredients ?? []);
  const [cuisines, setCuisines] = useState(existing?.preferred_cuisines ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const custom = allergies.filter((allergy) => !COMMON.includes(allergy));
  const common = allergies.filter((allergy) => COMMON.includes(allergy));

  const save = async () => {
    if (name.trim() === '') {
      setError('Add a name.');
      return;
    }
    const draft = {
      name: name.trim(),
      avatar,
      diet,
      allergies,
      liked_ingredients: liked,
      disliked_ingredients: disliked,
      preferred_cuisines: cuisines,
    };
    setSaving(true);
    try {
      if (existing) await update(existing.id, draft);
      else await add(draft);
      router.back();
    } catch (cause) {
      setSaving(false);
      Alert.alert('Could not save', messageOf(cause));
    }
  };

  const confirmRemove = () => {
    if (!existing) return;
    Alert.alert(`Remove ${existing.name}?`, 'Plans will no longer consider their allergies or diet.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          router.back();
          void remove(existing.id);
        },
      },
    ]);
  };

  const isMe = existing && session ? existing.user_id === session.user.id : false;

  return (
    <FormScreen
      title={existing ? 'Edit member' : 'Add member'}
      footer={<Button title="Save member" loading={saving} onPress={() => void save()} style={{ flex: 1 }} />}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Ana" error={error} />
      <Field label="Avatar">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars}>
          {AVATARS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: option === avatar }}
              accessibilityLabel={`Avatar ${option}`}
              onPress={() => setAvatar(option)}
              style={[
                styles.avatar,
                {
                  backgroundColor: option === avatar ? colors.primaryTint : colors.surface,
                  borderColor: option === avatar ? colors.primary : colors.border,
                },
              ]}>
              <Txt style={styles.emoji}>{option}</Txt>
            </Pressable>
          ))}
        </ScrollView>
      </Field>

      <Field label="Diet" hint="Plans never break this.">
        <ChipGroup>
          {DIETS.map((option) => (
            <Chip key={option} label={dietLabel(option)} selected={diet === option} onPress={() => setDiet(option)} />
          ))}
        </ChipGroup>
      </Field>

      <Field label="Allergies" hint="Plans never include these. Guiney checks ingredient names, so read labels too.">
        <ChipGroup>
          {ALLERGENS.map((option) => (
            <Chip
              key={option}
              multi
              label={option}
              selected={allergies.includes(option)}
              onPress={() =>
                setAllergies((all) =>
                  all.includes(option) ? all.filter((other) => other !== option) : [...all, option],
                )
              }
            />
          ))}
        </ChipGroup>
      </Field>
      <TagInput
        label="Other allergies"
        placeholder="mango, MSG"
        values={custom}
        onChange={(values) => setAllergies([...common, ...values])}
      />
      <TagInput label="Likes" placeholder="chicken, ginger" values={liked} onChange={setLiked} />
      <TagInput label="Dislikes" placeholder="eggplant" values={disliked} onChange={setDisliked} />
      <TagInput label="Favourite cuisines" placeholder="Filipino, Japanese" values={cuisines} onChange={setCuisines} />

      {existing && session ? (
        <View style={styles.gap}>
          <Button
            kind="tint"
            title={isMe ? 'This is not me' : 'This is me'}
            onPress={() => void link(existing.id, isMe ? null : session.user.id)}
          />
        </View>
      ) : null}
      {existing ? (
        <Button kind="danger" icon="trash-can-outline" title="Remove member" onPress={confirmRemove} />
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  avatars: { gap: spacing.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28, lineHeight: 36 },
  gap: { gap: spacing.sm },
});
