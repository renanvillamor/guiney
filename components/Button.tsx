import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { Palette } from '@/theme/colors';
import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

type Kind = 'primary' | 'tint' | 'plain' | 'danger';

const KINDS: Record<
  Kind,
  { bg: keyof Palette | null; pressed: keyof Palette; text: keyof Palette }
> = {
  primary: { bg: 'fill', pressed: 'fillPressed', text: 'onFill' },
  tint: { bg: 'primaryTint', pressed: 'border', text: 'text' },
  plain: { bg: null, pressed: 'primaryTint', text: 'accentText' },
  danger: { bg: null, pressed: 'dangerTint', text: 'danger' },
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  kind?: Kind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const colors = useColors();
  const look = KINDS[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed
            ? colors[look.pressed]
            : look.bg
              ? colors[look.bg]
              : 'transparent',
          opacity: disabled && !loading ? 0.5 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[look.text]} accessibilityLabel={title} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={look.text} /> : null}
          <Txt variant="button" color={look.text} center style={styles.label}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: keyof Palette;
  size?: number;
  disabled?: boolean;
  /** Fills the button, for use beside a text field. */
  tint?: boolean;
  /** A count in the corner. Say it in `label` too. */
  badge?: number;
}

export function IconButton({
  icon,
  label,
  onPress,
  color = 'text',
  size = 24,
  disabled = false,
  tint = false,
  badge = 0,
}: IconButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.icon,
        tint ? styles.iconTint : null,
        {
          backgroundColor: tint
            ? pressed
              ? colors.border
              : colors.primaryTint
            : pressed
              ? colors.primaryTint
              : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}>
      <Icon name={icon} size={size} color={color} />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.fill }]}>
          <Txt variant="caption" color="onFill" maxFontSizeMultiplier={1} style={styles.badgeText}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The one main action of a list screen. `label` is for screen readers. */
export function Fab({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.fabWrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed ? colors.fillPressed : colors.fill },
        ]}>
        <Icon name={icon} size={28} color="onFill" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: { flexShrink: 1 },
  icon: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTint: { borderRadius: radius.md },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { lineHeight: 18 },
  fabWrap: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  fab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    elevation: 3,
  },
});
