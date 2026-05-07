// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadows } from '../../src/theme';

const TabIcon = ({ name, color, focused }: { name: any; color: string; focused: boolean }) => {
  return (
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: colors.primaryLight },
      ]}
    >
      <Ionicons name={name} size={20} color={color} />
    </View>
  );
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          ...shadows.card,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarTestID: 'tab-home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="strategi"
        options={{
          title: 'Strategi',
          tabBarTestID: 'tab-strategi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'rocket' : 'rocket-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="action-plan"
        options={{
          title: 'Action Plan',
          tabBarTestID: 'tab-action-plan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'checkmark-done-circle' : 'checkmark-done-circle-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarTestID: 'tab-profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person-circle' : 'person-circle-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
