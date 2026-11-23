import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { IconButton } from './Button';
import { Icon } from './Icon';
import { Txt } from './Txt';

/** A tab screen: big title, its actions and the way to Profile on the right, content below. */
export function TabScreen({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Txt
          variant="hero"
          style={styles.flex}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {title}
        </Txt>
        {actions}
        <IconButton
          icon="account-circle-outline"
          label="Profile and household"
          onPress={() => router.push('/profile')}
        />
      </View>
      {children}
    </View>
  );
}

/** A stack screen with scrolling content and a save bar that stays above the keyboard. */
export function FormScreen({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={insets.top + 56}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.form,
          { paddingBottom: footer ? spacing.xl : insets.bottom + spacing.xl },
        ]}>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View>
        <Txt variant="heading">{title}</Txt>
        {hint ? (
          <Txt variant="caption" color="textMuted">
            {hint}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        padded ? styles.padded : null,
      ]}>
      {children}
    </View>
  );
}

/** A tappable line inside a Card. */
export function LinkRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  last = false,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Replaces the chevron, for a row that acts in place. */
  trailing?: ReactNode;
  onPress: () => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        {
          backgroundColor: pressed ? colors.primaryTint : 'transparent',
          borderBottomColor: colors.border,
          borderBottomWidth: last ? 0 : 1,
        },
      ]}>
      {leading}
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{title}</Txt>
        {subtitle ? (
          <Txt variant="caption" color="textMuted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ?? <Icon name="chevron-right" color="textMuted" />}
    </Pressable>
  );
}

/** A line inside a Card that only shows a value. */
export function InfoRow({ title, value }: { title: string; value: string }) {
  const colors = useColors();
  return (
    <View accessible style={[styles.link, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Txt variant="bodyStrong" style={styles.flex}>
        {title}
      </Txt>
      <Txt color="textMuted">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  form: { padding: spacing.lg, gap: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  section: { gap: spacing.md, marginTop: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  padded: { padding: spacing.lg, gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
