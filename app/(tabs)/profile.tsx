import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.initials ?? '??'}</Text>
      </View>
      <Text style={styles.name}>{user?.name?.toUpperCase() ?? 'USER'}</Text>
      <Text style={styles.email}>{user?.email ?? ''}</Text>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
        <Feather name="log-out" size={16} color="#1C1C1C" />
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6D696A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 28,
    color: '#E2DADB',
  },
  name: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 28,
    letterSpacing: 1,
    color: '#E2DADB',
  },
  email: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: '#6D696A',
    marginBottom: 24,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDD83D',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 50,
    marginTop: 16,
  },
  signOutText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 2,
    color: '#1C1C1C',
  },
});
