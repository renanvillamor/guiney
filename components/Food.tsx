import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';

import { expiryLabel, freshness } from '@/lib/dates';
import type { MemberWarning } from '@/lib/dietary';
import type { Category } from '@/types/models';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

import { Guiney } from './Guiney';
import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

export const CATEGORY_ICONS: Record<Category, IconName> = {
  breakfast: 'egg-fried',
  lunch: 'rice',
  dinner: 'food-drumstick-outline',
  snack: 'food-apple-outline',
  dessert: 'cupcake',
  soup: 'pot-steam-outline',
  side: 'carrot',
  drink: 'cup-outline',
};

export const categoryLabel = (category: string): string =>
  category.charAt(0).toUpperCase() + category.slice(1);

/** The dish, or its category on a warm tile when there is no photo (or it lives on another phone). */
export function RecipePhoto({
  uri,
  category,
  width,
  height,
  rounded = radius.md,
}: {
  uri: string | null;
  category: Category;
  width: DimensionValue;
  height: number;
  rounded?: number;
}) {
  const colors = useColors();
  const [failed, setFailed] = useState<string | null>(null);
  const show = uri !== null && failed !== uri;
  return (
    <View
      style={[
        styles.photo,
        { width, height, borderRadius: rounded, backgroundColor: colors.primaryTint },
      ]}>
      {show ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(uri)}
        />
      ) : (
        <Icon name={CATEGORY_ICONS[category]} size={Math.min(72, height * 0.45)} color="accentText" />
      )}
    </View>
  );
}

export function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <Icon name={icon} size={16} color="textMuted" />
      <Txt variant="caption" color="textMuted">
        {text}
      </Txt>
    </View>
  );
}

export function ExpiryBadge({ date }: { date: string | null }) {
  const colors = useColors();
  if (!date) return null;
  const state = freshness(date);
  if (state === 'fresh') {
    return (
      <Txt variant="caption" color="secondary">
        {expiryLabel(date)}
      </Txt>
    );
  }
  const expired = state === 'expired';
  return (
    <View style={[styles.badge, { backgroundColor: expired ? colors.danger : colors.warning }]}>
      <Txt variant="label" color={expired ? 'onDanger' : 'onWarning'}>
        {expiryLabel(date)}
      </Txt>
    </View>
  );
}

export function AllergyBanner({ warnings }: { warnings: MemberWarning[] }) {
  const colors = useColors();
  if (warnings.length === 0) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: colors.dangerTint, borderColor: colors.danger }]}>
      <Guiney variant="warning" size={64} decorative />
      <View style={styles.flex}>
        <Txt variant="subheading" color="danger">
          Allergy warning
        </Txt>
        {warnings.map(({ member, hits }) => (
          <Txt key={member.id}>
            {member.name}: {hits.map((hit) => `${hit.allergy} (${hit.found})`).join(', ')}
          </Txt>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
