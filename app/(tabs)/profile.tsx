import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { getMe } from '@/src/api';
import { User } from '@/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch(() => {});
  }, [token]);

  const initials = user?.email ? user.email[0].toUpperCase() : '?';
  const displayName = user?.email ? user.email.split('@')[0].toUpperCase() : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.email}>{user?.email ?? ''}</Text>

      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => void signOut()}
        activeOpacity={0.8}
      >
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
