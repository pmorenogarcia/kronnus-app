import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { listMySessions, SessionError } from '@/src/api';
import type { Session } from '@/src/api';

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  gold: '#EDD83D',
  silver: '#A2A7A5',
  bronze: '#8B5E3C',
  draftBg: 'rgba(162,167,165,0.08)',
  draftBorder: 'rgba(162,167,165,0.2)',
  draftText: '#A2A7A5',
};

const MONTHS_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

const SPORT_LABELS: Record<string, string> = {
  ATHLETICS: 'ATHLETICS',
  CYCLING: 'CYCLING',
  TRAIL_RUNNING: 'TRAIL RUN',
  SKI: 'SKI',
  SNOWBOARD: 'SNOWBOARD',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { draftCreated, draftName } = useLocalSearchParams<{
    draftCreated?: string;
    draftName?: string;
  }>();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadError, setLoadError] = useState(false);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastShown = useRef(false);

  useEffect(() => {
    if (!token) return;
    listMySessions(token)
      .then(setSessions)
      .catch((e) => {
        if (e instanceof SessionError) setLoadError(true);
      });
  }, [token, draftCreated]);

  useEffect(() => {
    if (draftCreated !== '1' || toastShown.current) return;
    toastShown.current = true;
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [draftCreated, toastAnim]);

  const displayName = 'USER';
  const initials = '??';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoRow}>
          <View style={styles.logoIconWrapper}>
            <Feather name="clock" size={20} color="#0F0F0F" />
          </View>
          <View>
            <Text style={styles.logoName}>KRONNUS</Text>
            <Text style={styles.logoTagline}>JUST IN TIME</Text>
          </View>
        </View>
        <View style={styles.avatarWrapper}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
          <Text style={styles.welcomeName}>{displayName}</Text>
        </View>

        {/* Action cards */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.createCard}
            activeOpacity={0.8}
            onPress={() => router.push('/create-session' as any)}
          >
            <Feather name="plus" size={28} color="#0F0F0F" />
            <View style={styles.cardLabelGroup}>
              <Text style={styles.createCardTitle}>CREATE</Text>
              <Text style={styles.createCardSub}>NEW SESSION</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.joinCard}
            activeOpacity={0.8}
            onPress={() => router.push('/join-session' as any)}
          >
            <Feather name="link" size={28} color={C.textMuted} />
            <View style={styles.cardLabelGroup}>
              <Text style={styles.joinCardTitle}>JOIN</Text>
              <Text style={styles.joinCardSub}>ENTER CODE</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
          {sessions.length > 0 && (
            <View style={styles.sessionCountBadge}>
              <Text style={styles.sessionCountText}>{sessions.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.sessionList}>
          {sessions.length === 0 && !loadError && (
            <View style={styles.emptyState}>
              <Feather name="clock" size={28} color={C.textSecondary} />
              <Text style={styles.emptyTitle}>NO SESSIONS YET</Text>
              <Text style={styles.emptyBody}>Create your first session to get started.</Text>
            </View>
          )}

          {loadError && (
            <View style={styles.emptyState}>
              <Feather name="wifi-off" size={28} color={C.textSecondary} />
              <Text style={styles.emptyTitle}>COULD NOT LOAD</Text>
              <Text style={styles.emptyBody}>Check your connection and pull to refresh.</Text>
            </View>
          )}

          {sessions.map((session) => {
            const isDraft = session.status === 'DRAFT';
            return (
              <TouchableOpacity key={session.id} style={styles.sessionCard} activeOpacity={0.7}>
                <View style={styles.sessionCardHeader}>
                  <View style={styles.sessionMeta}>
                    <View style={styles.sessionNameRow}>
                      <Text style={styles.sessionName}>{session.name}</Text>
                      {isDraft && (
                        <View style={styles.draftBadge}>
                          <Feather name="edit-2" size={9} color={C.draftText} />
                          <Text style={styles.draftBadgeText}>DRAFT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sessionInfo}>
                      {formatSessionDate(session.session_date)} ·{' '}
                      {SPORT_LABELS[session.sport] ?? session.sport}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={C.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Draft saved toast */}
      {draftCreated === '1' && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.toastIconWrap}>
            <Feather name="check" size={13} color="#0F0F0F" />
          </View>
          <View style={styles.toastTextGroup}>
            <Text style={styles.toastTitle} numberOfLines={1}>
              {draftName ?? 'Session'} <Text style={styles.toastSubtitle}>saved as draft</Text>
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgHeader,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EDD83D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.6,
    color: '#E2DADB',
  },
  logoTagline: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#6D696A',
    textTransform: 'uppercase',
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6D696A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: '#E2DADB',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Welcome
  welcome: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 4,
  },
  welcomeLabel: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  welcomeName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 42,
    letterSpacing: -0.4,
    color: C.textPrimary,
    lineHeight: 46,
  },

  // Action cards
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 12,
  },
  createCard: {
    flex: 1,
    backgroundColor: '#EDD83D',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  joinCard: {
    flex: 1,
    backgroundColor: C.bgCardAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  cardLabelGroup: {
    gap: 2,
  },
  createCardTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 22,
    letterSpacing: 0.8,
    color: '#0F0F0F',
  },
  createCardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(19,19,19,0.6)',
    textTransform: 'uppercase',
  },
  joinCardTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 22,
    letterSpacing: 0.8,
    color: C.textPrimary,
  },
  joinCardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 1.8,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  sessionCountBadge: {
    backgroundColor: 'rgba(237,216,61,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(237,216,61,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sessionCountText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    color: C.accent,
  },

  // Session list
  sessionList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  sessionCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sessionMeta: {
    gap: 3,
    flex: 1,
  },
  sessionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sessionName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 18,
    letterSpacing: 0.4,
    color: C.textPrimary,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.draftBg,
    borderWidth: 1,
    borderColor: C.draftBorder,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  draftBadgeText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.draftText,
    textTransform: 'uppercase',
  },
  sessionInfo: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  emptyBody: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },

  // Draft toast
  toast: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
    backgroundColor: '#1E1C1D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toastTextGroup: {
    flex: 1,
  },
  toastTitle: {
    fontFamily: 'Barlow-SemiBold',
    fontSize: 14,
    color: C.textPrimary,
  },
  toastSubtitle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textMuted,
  },
});
