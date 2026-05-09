import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { listSessions } from '@/src/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.10)',
  accentBorder: 'rgba(237,216,61,0.22)',
  accentRing: 'rgba(237,216,61,0.30)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  danger: '#E05252',
  dangerBg: 'rgba(224,82,82,0.08)',
  dangerBorder: 'rgba(224,82,82,0.20)',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, signOut } = useAuth();
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      listSessions(token)
        .then((list) => setSessionCount(list.length))
        .catch(() => {});
    }, [token]),
  );

  if (!user) {
    return (
      <View style={[styles.root, styles.loadingWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.accent} size="small" />
      </View>
    );
  }

  const displayName = user.username ?? (user.email ? user.email.split('@')[0] : null);
  const handle = user.username ? `@${user.username}` : (user.email ?? '');
  const initial = (user.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSlot} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MY PROFILE</Text>
          <Text style={styles.headerSub}>KRONNUS</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => router.push('/edit-profile' as never)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="edit-2" size={16} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{displayName?.toUpperCase() ?? '—'}</Text>
          <Text style={styles.heroHandle}>{handle}</Text>

          {sessionCount !== null && (
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sessionCount}</Text>
                <Text style={styles.statLabel}>SESSIONS</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Account info ── */}
        <Text style={styles.sectionLabel}>ACCOUNT INFO</Text>
        <View style={styles.infoGroup}>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <View style={styles.infoIcon}>
              <Feather name="user" size={14} color={C.textMuted} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>USERNAME</Text>
              <Text style={styles.infoValue}>{user.username ?? '—'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="mail" size={14} color={C.textMuted} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>EMAIL</Text>
              <Text style={styles.infoValue}>{user.email ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
          <Feather name="log-out" size={15} color={C.danger} />
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loadingWrap: { justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgHeader,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerSlot: { width: 38, height: 38 },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.5,
    color: C.textPrimary,
  },
  headerSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 32, gap: 12 },

  // Hero
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatarRing: {
    padding: 4,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: C.accentRing,
    marginBottom: 4,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 38,
    color: C.accent,
    lineHeight: 44,
  },
  heroName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 30,
    letterSpacing: 0.6,
    color: C.textPrimary,
    lineHeight: 34,
  },
  heroHandle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textSecondary,
  },
  statRow: { flexDirection: 'row', gap: 24, marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 26,
    color: C.accent,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Section label
  sectionLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 4,
  },

  // Info rows
  infoGroup: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoContent: { flex: 1, gap: 2 },
  infoLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: 'Barlow-SemiBold',
    fontSize: 15,
    color: C.textPrimary,
  },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.dangerBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    paddingVertical: 14,
    marginTop: 8,
  },
  signOutText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: C.danger,
  },
});
