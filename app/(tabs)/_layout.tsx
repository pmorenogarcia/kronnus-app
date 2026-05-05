import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const C = {
  bgTab: '#0F0F0F',
  borderTab: '#2A2728',
  active: '#EDD83D',
  inactive: '#6D696A',
};

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TabIconProps {
  name: FeatherIconName;
  label: string;
  color: string;
}

function TabIcon({ name, label, color }: TabIconProps) {
  return (
    <View style={styles.tabIconWrap}>
      <Feather name={name} size={22} color={color} />
      <Text
        style={[styles.tabLabel, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: C.active,
        tabBarInactiveTintColor: C.inactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" label="HOME" color={color} />,
        }}
      />
      <Tabs.Screen
        name="timing"
        options={{
          title: 'Timing',
          tabBarIcon: ({ color }) => <TabIcon name="clock" label="TIMING" color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="user" label="PROFILE" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bgTab,
    borderTopWidth: 1,
    borderTopColor: C.borderTab,
    height: 80,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 0,
  },
});
