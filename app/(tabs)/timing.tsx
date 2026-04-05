import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TimingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Feather name="clock" size={48} color="#EDD83D" />
      <Text style={styles.title}>TIMING</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 32,
    letterSpacing: 2,
    color: '#E2DADB',
  },
  subtitle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: '#6D696A',
  },
});
