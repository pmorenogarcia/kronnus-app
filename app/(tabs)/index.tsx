import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { deleteSession, listSessions, SessionError } from '@/src/api';
import type { Session, SessionStatus } from '@/src/api';
import { SessionStatusBadge } from '@/src/components';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.10)',
  accentBorder: 'rgba(237,216,61,0.22)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  error: '#E05C5C',
  errorBg: 'rgba(224,92,92,0.08)',
  errorBorder: 'rgba(224,92,92,0.22)',
  activeBorder: 'rgba(76,175,138,0.30)',
  waitingBorder: 'rgba(100,140,255,0.28)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getUserIdFromToken(token: string): string {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload)) as { sub?: string };
    return decoded.sub ?? '';
  } catch {
    return '';
  }
}

const SPORT_META: Record<string, { label: string; icon: string }> = {
  ATHLETICS: { label: 'ATHLETICS', icon: 'run' },
  CYCLING: { label: 'CYCLING', icon: 'bike' },
  TRAIL_RUNNING: { label: 'TRAIL RUN', icon: 'hiking' },
  SKI: { label: 'SKI', icon: 'ski' },
  SNOWBOARD: { label: 'SNOWBOARD', icon: 'snowboard' },
};

function cardBorderColor(status: SessionStatus): string {
  if (status === 'ACTIVE') return C.activeBorder;
  if (status === 'WAITING') return C.waitingBorder;
  return C.border;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DeletePhase = 'confirm' | 'deleting' | 'error';

interface DeleteState {
  sessionId: string;
  phase: DeletePhase;
  errorMsg?: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { draftCreated, draftName } = useLocalSearchParams<{
    draftCreated?: string;
    draftName?: string;
  }>();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastShown = useRef(false);

  // Session fetch (shared by focus effect + pull-to-refresh)
  const fetchSessions = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const list = await listSessions(token);
        setSessions(list);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [token],
  );

  // Re-fetch on every focus (picks up changes from other screens)
  useFocusEffect(
    useCallback(() => {
      fetchSessions();
    }, [fetchSessions]),
  );

  // Toast on draft save
  useEffect(() => {
    if (draftCreated !== '1' || toastShown.current) return;
    toastShown.current = true;
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [draftCreated, toastAnim]);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function navigateToSession(session: Session) {
    // Clear any open delete state before navigating
    setDeleteState(null);
    switch (session.status) {
      case 'FINISHED':
        router.push({
          pathname: '/(tabs)/results' as never,
          params: { session_code: session.session_code },
        });
        break;
      case 'DRAFT':
      case 'WAITING':
        router.push({
          pathname: '/session-setup' as never,
          params: {
            session_id: session.id,
            session_code: session.session_code,
            session_name: session.name,
          },
        });
        break;
      case 'ACTIVE': {
        const userId = token ? getUserIdFromToken(token) : '';
        router.push({
          pathname: '/(tabs)/timing' as never,
          params: {
            session_id: session.id,
            session_code: session.session_code,
            session_name: session.name,
            is_coordinator: session.created_by === userId ? 'true' : 'false',
            offset_ms: '0',
          },
        });
        break;
      }
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(sessionId: string) {
    if (!token) return;
    const snapshot = sessions;
    setDeleteState({ sessionId, phase: 'deleting' });
    setSessions((s) => s.filter((x) => x.id !== sessionId));
    try {
      await deleteSession(token, sessionId);
      setDeleteState(null);
    } catch (e) {
      setSessions(snapshot);
      if (e instanceof SessionError && e.statusCode === 409) {
        setDeleteState({ sessionId, phase: 'error', errorMsg: e.message });
      } else {
        setDeleteState(null);
      }
    }
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const displayName =
    user?.username?.toUpperCase() ?? (user?.email ? user.email.split('@')[0].toUpperCase() : '—');
  const initials = (user?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  // ─── Render ──────────────────────────────────────────────────────────────────

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSessions(true)}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
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
            onPress={() => router.push('/create-session' as never)}
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
            onPress={() => router.push('/join-session' as never)}
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
          {/* Empty / error states */}
          {!loading && sessions.length === 0 && !loadError && (
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

          {/* Session cards */}
          {sessions.map((session) => {
            const sport = SPORT_META[session.sport] ?? {
              label: session.sport,
              icon: 'timer-outline',
            };
            const isDeleting =
              deleteState?.sessionId === session.id && deleteState.phase === 'deleting';
            const isConfirming =
              deleteState?.sessionId === session.id && deleteState.phase === 'confirm';
            const isError = deleteState?.sessionId === session.id && deleteState.phase === 'error';
            const menuOpen = isConfirming || isError || isDeleting;

            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, { borderColor: cardBorderColor(session.status) }]}
                activeOpacity={menuOpen ? 1 : 0.72}
                onPress={() => {
                  if (menuOpen) return;
                  navigateToSession(session);
                }}
              >
                {/* Card header row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {session.name}
                    </Text>
                    <View style={styles.cardSubRow}>
                      <MaterialCommunityIcons
                        name={sport.icon as never}
                        size={11}
                        color={C.textSecondary}
                      />
                      <Text style={styles.cardSub}>
                        {sport.label} · {formatDate(session.session_date)}
                      </Text>
                    </View>
                  </View>

                  {/* Three dots / close */}
                  <TouchableOpacity
                    style={styles.menuBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => {
                      if (menuOpen) {
                        setDeleteState(null);
                      } else {
                        setDeleteState({ sessionId: session.id, phase: 'confirm' });
                      }
                    }}
                  >
                    <Feather
                      name={menuOpen ? 'x' : 'more-vertical'}
                      size={16}
                      color={menuOpen ? C.textMuted : C.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Badge + counts row (normal state) */}
                {!menuOpen && (
                  <View style={styles.cardFooterRow}>
                    <SessionStatusBadge status={session.status} />
                    {(session.competitor_count !== undefined ||
                      session.checkpoint_count !== undefined) && (
                      <View style={styles.cardCounts}>
                        {session.competitor_count !== undefined && (
                          <View style={styles.countChip}>
                            <Feather name="users" size={9} color={C.textSecondary} />
                            <Text style={styles.countText}>{session.competitor_count}</Text>
                          </View>
                        )}
                        {session.checkpoint_count !== undefined && (
                          <View style={styles.countChip}>
                            <Feather name="map-pin" size={9} color={C.textSecondary} />
                            <Text style={styles.countText}>{session.checkpoint_count}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <Feather
                      name="chevron-right"
                      size={14}
                      color={C.textSecondary}
                      style={styles.chevron}
                    />
                  </View>
                )}

                {/* Delete confirm panel */}
                {isConfirming && (
                  <View style={styles.deletePanel}>
                    <Text style={styles.deletePanelText}>Delete this session?</Text>
                    <View style={styles.deletePanelActions}>
                      <TouchableOpacity
                        style={styles.deleteConfirmBtn}
                        activeOpacity={0.8}
                        onPress={() => handleDelete(session.id)}
                      >
                        <Feather name="trash-2" size={12} color={C.error} />
                        <Text style={styles.deleteConfirmBtnText}>DELETE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteCancelBtn}
                        activeOpacity={0.8}
                        onPress={() => setDeleteState(null)}
                      >
                        <Text style={styles.deleteCancelBtnText}>CANCEL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Deleting indicator */}
                {isDeleting && (
                  <View style={styles.deletePanel}>
                    <Text style={styles.deletingText}>Deleting…</Text>
                  </View>
                )}

                {/* Delete error panel */}
                {isError && (
                  <View style={[styles.deletePanel, styles.deletePanelError]}>
                    <Feather name="alert-circle" size={13} color={C.error} />
                    <Text style={styles.deleteErrorText}>{deleteState?.errorMsg}</Text>
                    <TouchableOpacity
                      onPress={() => setDeleteState(null)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.dismissText}>DISMISS</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
              bottom: insets.bottom + 90,
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoName: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.6,
    color: C.textPrimary,
  },
  logoTagline: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3A3638',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: C.textMuted,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // Welcome
  welcome: { paddingHorizontal: 24, paddingTop: 28, gap: 4 },
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
  actionRow: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 28, gap: 12 },
  createCard: {
    flex: 1,
    backgroundColor: C.accent,
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
  cardLabelGroup: { gap: 2 },
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
    color: 'rgba(19,19,19,0.55)',
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
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
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
  sessionList: { paddingHorizontal: 24, gap: 10 },

  // Session card
  sessionCard: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: { flex: 1, gap: 4 },
  cardName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 18,
    letterSpacing: 0.3,
    color: C.textPrimary,
  },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  menuBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: C.bgCardAlt,
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardCounts: { flexDirection: 'row', gap: 8, flex: 1 },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.textSecondary,
  },
  chevron: { marginLeft: 'auto' },

  // Delete panel
  deletePanel: {
    paddingTop: 4,
    gap: 10,
  },
  deletePanelError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.errorBg,
    borderRadius: 8,
    padding: 10,
  },
  deletePanelText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  deletePanelActions: { flexDirection: 'row', gap: 8 },
  deleteConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
  },
  deleteConfirmBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: C.error,
  },
  deleteCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: C.bgCardAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  deleteCancelBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: C.textMuted,
  },
  deletingText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
  },
  deleteErrorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.error,
    flex: 1,
    lineHeight: 17,
  },
  dismissText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: C.error,
  },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
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

  // Toast
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: C.bgCardAlt,
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
  toastTextGroup: { flex: 1 },
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
