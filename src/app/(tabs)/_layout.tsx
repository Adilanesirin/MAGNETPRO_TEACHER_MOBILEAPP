import { theme } from '@/constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const currentRoute = segments[segments.length - 1];

  const tabs = [
    { name: 'index',      label: 'Dashboard', icon: 'dashboard' },
    { name: 'students',   label: 'Students',  icon: 'people' },
    { name: 'attendance', label: 'Attendance', icon: 'event-available' },
  ];

  // Hide on diary screen
  if (currentRoute === 'teacherdiaryscreen') return null;

  return (
    // ✅ FIX: removed position:'absolute' — tab bar now sits in normal flow
    // at the bottom of the screen. Content above it scrolls freely and is
    // never hidden behind it.
    <View style={[
      styles.tabBarContainer,
      { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 },
    ]}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive =
            currentRoute === tab.name ||
            (currentRoute === '(tabs)' && tab.name === 'index');
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => router.push(tab.name === 'index' ? '/' : `/${tab.name}`)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={24}
                color={isActive ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={[
                styles.tabLabel,
                { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="students" />
      <Tabs.Screen name="attendance" />
      <Tabs.Screen name="teacherdiaryscreen" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    // ✅ NO position:'absolute' — sits in normal document flow
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: -8,
    backgroundColor: 'transparent', // so the page bg shows behind the gap
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: Platform.OS === 'ios' ? 8 : 0,
    paddingBottom: -1,
    marginTop: 9,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});