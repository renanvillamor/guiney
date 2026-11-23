import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { formatDate, fromISODate, toISODate, today, weekday } from '@/lib/dates';
import { unitsForSystem, type InputUnit } from '@/lib/units';
import { useSettings } from '@/store/settings';
import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { IconButton } from './Button';
import { Icon } from './Icon';
import { Sheet, SheetRow } from './Sheet';
import { Txt } from './Txt';

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Txt variant="label">{label}</Txt>
      {children}
      {error ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" color="textMuted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

interface InputProps extends TextInputProps {
  label: string;
  invalid?: boolean;
}

/** A bare input. `label` is read aloud; use TextField when it should be visible too. */
export function Input({ label, invalid = false, style, multiline, ...rest }: InputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      multiline={multiline}
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        rest.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        rest.onBlur?.(event);
      }}
      style={[
        styles.input,
        multiline ? styles.multiline : null,
        {
          backgroundColor: colors.surface,
          color: colors.text,
          borderColor: invalid ? colors.danger : focused ? colors.primary : colors.border,
        },
        style,
      ]}
    />
  );
}

export function TextField({
  label,
  error,
  hint,
  ...rest
}: InputProps & { error?: string | null; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <Input label={label} invalid={!!error} {...rest} />
    </Field>
  );
}

/** A field that opens something: a date picker or a list. */
export function PressField({
  label,
  value,
  placeholder,
  onPress,
  onClear,
  compact = false,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onPress: () => void;
  onClear?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.press, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ?? placeholder ?? 'not set'}`}
        onPress={onPress}
        style={[styles.pressInner, compact ? styles.compact : null]}>
        <Txt color={value ? 'text' : 'textMuted'} numberOfLines={1} style={styles.flex}>
          {value ?? placeholder}
        </Txt>
        {value && onClear ? null : <Icon name="chevron-down" size={20} color="textMuted" />}
      </Pressable>
      {value && onClear ? (
        <IconButton icon="close" size={18} color="textMuted" label={`Clear ${label}`} onPress={onClear} />
      ) : null}
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  optional = false,
  max,
  error,
  hideLabel = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
  max?: string;
  error?: string | null;
  hideLabel?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <PressField
        label={label}
        value={value ? `${weekday(value).slice(0, 3)} ${formatDate(value)}` : null}
        placeholder={optional ? 'No date' : 'Pick a date'}
        onPress={() => setOpen(true)}
        onClear={optional ? () => onChange(null) : undefined}
      />
      {open ? (
        <DateTimePicker
          mode="date"
          value={fromISODate(value ?? today())}
          maximumDate={max ? fromISODate(max) : undefined}
          accentColor={colors.primary}
          themeVariant={scheme}
          onValueChange={(_event, date) => {
            setOpen(false);
            onChange(toISODate(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
  return hideLabel ? (
    body
  ) : (
    <Field label={label} error={error}>
      {body}
    </Field>
  );
}

const UNIT_NAMES: Record<InputUnit, string> = {
  g: 'grams',
  kg: 'kilograms',
  oz: 'ounces',
  lb: 'pounds',
  ml: 'millilitres',
  l: 'litres',
  tsp: 'teaspoons',
  tbsp: 'tablespoons',
  cup: 'cups',
  'fl oz': 'fluid ounces',
  piece: 'pieces',
};

/** Amount and unit, offering the units of the chosen system. */
export function QuantityInput({
  quantity,
  unit,
  onQuantity,
  onUnit,
  label = 'Amount',
}: {
  quantity: string;
  unit: InputUnit;
  onQuantity: (value: string) => void;
  onUnit: (unit: InputUnit) => void;
  label?: string;
}) {
  const system = useSettings((state) => state.unitSystem);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.quantity}>
      <Input
        label={label}
        value={quantity}
        onChangeText={onQuantity}
        placeholder="Amount"
        keyboardType="decimal-pad"
        style={styles.flex}
      />
      <View style={styles.unit}>
        <PressField label="Unit" value={unit === 'piece' ? 'pcs' : unit} onPress={() => setOpen(true)} compact />
      </View>
      <Sheet visible={open} title="Unit" onClose={() => setOpen(false)}>
        {unitsForSystem(system).map((option) => (
          <SheetRow
            key={option}
            title={UNIT_NAMES[option]}
            selected={option === unit}
            onPress={() => {
              onUnit(option);
              setOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  flex: { flex: 1 },
  input: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  press: {
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressInner: {
    flex: 1,
    minHeight: TOUCH - 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  compact: { paddingHorizontal: spacing.sm + 2, gap: 2 },
  quantity: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
  unit: { width: 92 },
});
