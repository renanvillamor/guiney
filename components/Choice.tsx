import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { IconButton } from './Button';
import { Field, Input } from './Fields';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  multi = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Part of a pick-any group rather than pick-one. */
  multi?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'button'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected || pressed ? colors.primaryTint : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}>
      {icon ? <Icon name={icon} size={18} color={selected ? 'accentText' : 'textMuted'} /> : null}
      <Txt variant="label" color={selected ? 'accentText' : 'text'}>
        {label}
      </Txt>
      {selected && multi ? <Icon name="check" size={16} color="accentText" /> : null}
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

/** Two or three exclusive views of the same thing. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: colors.primaryTint }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}>
            <Txt variant={selected ? 'bodyStrong' : 'body'} center numberOfLines={1}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A list of words the person types themselves. */
export function TagInput({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const colors = useColors();
  const [text, setText] = useState('');

  const add = () => {
    const words = text
      .split(',')
      .map((word) => word.trim())
      .filter((word) => word !== '');
    const fresh = words.filter(
      (word, index) =>
        ![...values, ...words.slice(0, index)].some(
          (other) => other.toLowerCase() === word.toLowerCase(),
        ),
    );
    if (fresh.length > 0) onChange([...values, ...fresh]);
    setText('');
  };

  return (
    <Field label={label} hint={hint}>
      {values.length > 0 ? (
        <View style={styles.group}>
          {values.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${value}`}
              onPress={() => onChange(values.filter((other) => other !== value))}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.chip, { backgroundColor: colors.primaryTint, borderColor: colors.primaryTint }]}>
              <Txt variant="label">{value}</Txt>
              <Icon name="close" size={16} color="text" />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.tagRow}>
        <Input
          label={label}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          onSubmitEditing={add}
          onBlur={add}
          submitBehavior="submit"
          returnKeyType="done"
          style={styles.flex}
        />
        <IconButton icon="plus" label={`Add to ${label}`} onPress={add} color="accentText" />
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 4, gap: 4 },
  segment: {
    flex: 1,
    minHeight: TOUCH - 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
