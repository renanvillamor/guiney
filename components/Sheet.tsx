import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, TOUCH } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ visible, title, onClose, children, footer }: SheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm },
        ]}>
        <View style={styles.header}>
          <Txt variant="heading" style={styles.flex}>
            {title}
          </Txt>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          style={styles.scroll}>
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

export function SheetRow({
  title,
  subtitle,
  icon,
  selected = false,
  danger = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  selected?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed || selected ? colors.primaryTint : 'transparent' },
      ]}>
      {icon ? <Icon name={icon} size={22} color={danger ? 'danger' : 'text'} /> : null}
      <View style={styles.flex}>
        <Txt variant={selected ? 'bodyStrong' : 'body'} color={danger ? 'danger' : 'text'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" color="textMuted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color="accentText" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingTop: spacing.sm,
  },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 2 },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  row: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
