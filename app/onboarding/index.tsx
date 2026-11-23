import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Guiney, type GuineyVariant } from '@/components/Guiney';
import { Icon, type IconName } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { useSettings } from '@/store/settings';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';

interface Page {
  art: GuineyVariant;
  title: string;
  body: string;
  points: { icon: IconName; text: string }[];
}

const PAGES: Page[] = [
  {
    art: 'icon',
    title: "Hi, I'm Guiney, your kitchen buddy!",
    body: 'Your recipes live here. Write them down, or copy one and make it your own.',
    points: [
      { icon: 'book-open-page-variant-outline', text: 'Ten recipes to start you off' },
      { icon: 'alert-circle-outline', text: 'A warning when a dish is not safe for someone at home' },
    ],
  },
  {
    art: 'empty-fridge',
    title: "Tell me what's in the fridge",
    body: "I'll plan the week around it, starting with what needs eating first.",
    points: [
      { icon: 'fridge-outline', text: 'Expiry dates and pre-cooked meals in one place' },
      { icon: 'calendar-month-outline', text: 'A plan that respects allergies, diets and favourites' },
    ],
  },
  {
    art: 'empty-groceries',
    title: "Then I'll write the grocery list",
    body: 'Only what you still need. Tick things off and they go straight to the fridge.',
    points: [
      { icon: 'basket-outline', text: 'Duplicates added up, fridge stock taken off' },
      { icon: 'share-variant-outline', text: 'Send the list to whoever is at the shop' },
    ],
  },
];

export default function Onboarding() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const save = useSettings((state) => state.set);
  const [index, setIndex] = useState(0);
  const page = PAGES[index] ?? PAGES[0]!;
  const last = index === PAGES.length - 1;
  const finish = () => void save({ onboarded: true });

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}>
      <View style={styles.top}>
        {index > 0 ? (
          <Button kind="plain" title="Back" onPress={() => setIndex(index - 1)} />
        ) : (
          <View />
        )}
        {last ? <View /> : <Button kind="plain" title="Skip" onPress={finish} />}
      </View>

      <ScrollView key={index} contentContainerStyle={styles.content}>
        <Guiney variant={page.art} size={240} />
        <Txt variant="hero" center>
          {page.title}
        </Txt>
        <Txt center color="textMuted" style={styles.body}>
          {page.body}
        </Txt>
        <View style={styles.points}>
          {page.points.map((point) => (
            <View key={point.text} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: colors.primaryTint }]}>
                <Icon name={point.icon} color="accentText" size={22} />
              </View>
              <Txt style={styles.flex}>{point.text}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <View
          style={styles.progress}
          accessible
          accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}>
          {PAGES.map((item, i) => (
            <View
              key={item.title}
              style={[
                styles.bar,
                { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 28 : 10 },
              ]}
            />
          ))}
        </View>
        <Button
          title={last ? "Let's cook" : 'Next'}
          onPress={() => (last ? finish() : setIndex(index + 1))}
          style={styles.next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: spacing.lg },
  flex: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  body: { maxWidth: 320, alignSelf: 'center' },
  points: { gap: spacing.md, marginTop: spacing.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  progress: { flexDirection: 'row', gap: 6 },
  bar: { height: 10, borderRadius: 5 },
  next: { minWidth: 140 },
});
