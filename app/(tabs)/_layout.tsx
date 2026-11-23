import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { radius, spacing } from '@/theme/spacing';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: 'index', title: 'Recipes', icon: 'book-open-page-variant-outline', active: 'book-open-page-variant' },
  { name: 'fridge', title: 'Fridge', icon: 'fridge-outline', active: 'fridge' },
  { name: 'planner', title: 'Planner', icon: 'calendar-month-outline', active: 'calendar-month' },
  { name: 'groceries', title: 'Groceries', icon: 'basket-outline', active: 'basket' },
];

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.sm);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarAllowFontScaling: false,
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <View
                style={[styles.pill, { backgroundColor: focused ? colors.primaryTint : 'transparent' }]}>
                <Icon
                  name={focused ? tab.active : tab.icon}
                  size={22}
                  color={focused ? 'accentText' : 'textMuted'}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 52,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
