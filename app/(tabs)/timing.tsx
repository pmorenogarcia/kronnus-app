import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Tabs, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { assignCompetitor, captureTimestamp, TimestampError } from '@/src/api/timestamps';
import type { Timestamp } from '@/src/api/timestamps';
import { listCompetitors } from '@/src/api';
import type { Competitor } from '@/src/api';
import { useSessionSocket } from '@/src/hooks';

// ─── Design tokens (Paper) ────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgBar: '#0F0F0F',
  bgModal: '#181617',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentBg: '#EDD83D14',
  accentBorder: '#EDD83D40',
  accentGlow: '#EDD83D59',
  accentAura: '#EDD83D1F',
  accentTimerGlow: '#EDD83D66',
  accentMs: '#EDD83D80',
  accentModalGlow: '#EDD83D4D',
  accentMs2: '#EDD83D73',
  accentAssignedBorder: '#EDD83D33',
  border: '#2A2728',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): { hms: string; cs: string } {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1_000);
  const cs = Math.floor((total % 1_000) / 10);
  return {
    hms: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    cs: `.${String(cs).padStart(2, '0')}`,
  };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingCapture {
  timestamp: Timestamp;
  capturedAtMs: number;
}

interface QueuedCapture {
  capturedAtMs: number;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimingScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const {
    session_code,
    session_name,
    session_id,
    competitors: competitorsParam,
    session_start_ms,
    offset_ms,
    is_coordinator,
    role,
  } = useLocalSearchParams<{
    session_code?: string;
    session_name?: string;
    session_id?: string;
    competitors?: string;
    session_start_ms?: string;
    offset_ms?: string;
    is_coordinator?: string;
    role?: string;
  }>();

  const isCoordinator = is_coordinator === 'true';

  const code = session_code ?? '';
  const sessionName = session_name ?? '';

  // Freeze session start on mount — never recalculate from render
  const offsetMs = Number(offset_ms ?? 0);
  const sessionStartMs = useRef(
    session_start_ms ? Number(session_start_ms) : Date.now() + Number(offset_ms ?? 0),
  ).current;

  const getCorrectedTimestamp = useCallback(() => Date.now() + offsetMs, [offsetMs]);

  const [competitors, setCompetitors] = useState<Competitor[]>(() => {
    if (!competitorsParam) return [];
    try {
      return JSON.parse(competitorsParam) as Competitor[];
    } catch {
      return [];
    }
  });

  // Operators arrive from waiting-room without competitors in params — fetch them
  useEffect(() => {
    if (competitorsParam || !token || !code) return;
    let cancelled = false;
    listCompetitors(token, code)
      .then((list) => {
        if (!cancelled) setCompetitors(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, code, competitorsParam]);

  // ─── WebSocket ────────────────────────────────────────────────────────────

  const socket = useSessionSocket(session_id ?? null);
  const { lastMessage, send, status: wsStatus } = socket;

  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    if (lastMessage?.type === 'SESSION_END') {
      setSessionEnded(true);
      router.replace({
        pathname: '/(tabs)/results' as never,
        params: { session_code: code },
      });
    }
  }, [lastMessage, code]);

  // ─── Timer ────────────────────────────────────────────────────────────────

  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (sessionEnded) return;
    const id = setInterval(() => {
      setElapsedMs(getCorrectedTimestamp() - sessionStartMs);
    }, 50);
    return () => clearInterval(id);
  }, [getCorrectedTimestamp, sessionStartMs, sessionEnded]);

  const { hms, cs } = formatElapsed(elapsedMs);

  // ─── Capture state ────────────────────────────────────────────────────────

  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [flushing, setFlushing] = useState(false);
  // competitorId → elapsed ms at capture
  const [assignedMap, setAssignedMap] = useState<Map<string, number>>(new Map());

  // ─── Offline queue flush ──────────────────────────────────────────────────

  useEffect(() => {
    if (
      wsStatus !== 'connected' ||
      pendingCapture !== null ||
      queue.length === 0 ||
      flushing ||
      !token
    )
      return;

    const item = queue[0];
    setFlushing(true);
    captureTimestamp(token, code, item.capturedAtMs)
      .then((ts) => {
        setQueue((prev) => prev.slice(1));
        openModal({ timestamp: ts, capturedAtMs: item.capturedAtMs });
      })
      .catch(() => {
        /* leave item in queue, retry on next reconnect */
      })
      .finally(() => setFlushing(false));
  }, [wsStatus, pendingCapture, queue, flushing, token, code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Animations ───────────────────────────────────────────────────────────

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const modalSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  function openModal(capture: PendingCapture) {
    setPendingCapture(capture);
    Animated.parallel([
      Animated.spring(modalSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function closeModal() {
    setAssignError(null);
    Animated.parallel([
      Animated.timing(modalSlide, {
        toValue: SCREEN_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setPendingCapture(null));
  }

  // ─── Bolt button ──────────────────────────────────────────────────────────

  function handlePressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }

  async function handleCapture() {
    // Critical path — capture timestamp BEFORE any async work
    const capturedAtMs = getCorrectedTimestamp();

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();

    if (!token) return;

    try {
      const ts = await captureTimestamp(token, code, capturedAtMs);
      openModal({ timestamp: ts, capturedAtMs });
    } catch {
      setQueue((prev) => [...prev, { capturedAtMs }]);
    }
  }

  // ─── Assignment ───────────────────────────────────────────────────────────

  async function handleAssign(competitorId: string) {
    if (!token || !pendingCapture) return;
    setAssignError(null);
    try {
      await assignCompetitor(token, code, pendingCapture.timestamp.id, competitorId);
      const elapsed = pendingCapture.capturedAtMs - sessionStartMs;
      setAssignedMap((prev) => new Map(prev).set(competitorId, elapsed));
      closeModal();
    } catch (err) {
      if (err instanceof TimestampError && err.statusCode === 422) {
        setAssignError(err.message);
        // keep modal open so operator sees the reason
      } else {
        closeModal();
      }
    }
  }

  // ─── FINISH button ────────────────────────────────────────────────────────

  const [confirmFinish, setConfirmFinish] = useState(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFinishPress() {
    if (!confirmFinish) {
      setConfirmFinish(true);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      finishTimerRef.current = setTimeout(() => setConfirmFinish(false), 4000);
      return;
    }
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    send('SESSION_END', {});
  }

  useEffect(
    () => () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    [],
  );

  // ─── Camera tooltip ───────────────────────────────────────────────────────

  const [showCameraTooltip, setShowCameraTooltip] = useState(false);

  function handleCameraPress() {
    setShowCameraTooltip(true);
    setTimeout(() => setShowCameraTooltip(false), 2000);
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const assignedCount = assignedMap.size;
  const totalCount = competitors.length;
  const pendingCompetitors = competitors.filter((c) => !assignedMap.has(c.id));
  const capturedElapsed = pendingCapture
    ? formatElapsed(pendingCapture.capturedAtMs - sessionStartMs)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, headerShown: false }} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>

        {isCoordinator &&
          (confirmFinish ? (
            <TouchableOpacity
              style={styles.finishConfirmBtn}
              onPress={handleFinishPress}
              activeOpacity={0.85}
            >
              <Text style={styles.finishConfirmText}>CONFIRM END</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.finishBtn}
              onPress={handleFinishPress}
              activeOpacity={0.7}
            >
              <Feather name="flag" size={14} color={C.accent} />
              <Text style={styles.finishText}>FINISH</Text>
            </TouchableOpacity>
          ))}
        {!isCoordinator && <View style={styles.backBtn} />}
      </View>

      {/* ── Timer zone ── */}
      <View style={styles.timerZone}>
        {/* Mode toggles — absolute top-right */}
        <View style={styles.modeToggles}>
          <View style={styles.modeActiveBtn}>
            <Feather name="circle" size={20} color="#0F0F0F" />
          </View>
          <TouchableOpacity
            style={styles.modeInactiveBtn}
            onPress={handleCameraPress}
            activeOpacity={0.7}
          >
            <Feather name="camera" size={20} color={C.textMuted} />
          </TouchableOpacity>
          {showCameraTooltip && (
            <View style={styles.cameraTooltip}>
              <Text style={styles.cameraTooltipText}>Coming soon</Text>
            </View>
          )}
        </View>

        <Text style={styles.sessionName} numberOfLines={1}>
          {sessionName.toUpperCase()}
        </Text>

        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{role}</Text>
          </View>
        ) : null}

        <Text style={styles.elapsedLabel}>ELAPSED TIME</Text>

        {/* Timer */}
        <View style={styles.timerRow}>
          <Text style={styles.timerHms}>{hms}</Text>
          <Text style={styles.timerCs}>{cs}</Text>
        </View>

        {/* Queue badge */}
        {queue.length > 0 && (
          <View style={styles.queueBadge}>
            <Feather name="clock" size={11} color={C.accent} />
            <Text style={styles.queueBadgeText}>{queue.length} queued</Text>
          </View>
        )}

        {/* Bolt trigger button */}
        <Animated.View style={[styles.boltContainer, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.boltAura} pointerEvents="none" />
          <TouchableOpacity
            style={styles.boltButton}
            onPress={handleCapture}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            <Feather name="zap" size={32} color="#0F0F0F" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Competitors bar ── */}
      <View style={[styles.competitorsBar, { paddingBottom: Math.max(32, insets.bottom + 12) }]}>
        <View style={styles.competitorsHeader}>
          <View style={styles.competitorsHeaderLeft}>
            <Feather name="users" size={14} color={C.textSecondary} />
            <Text style={styles.competitorsLabel}>
              COMPETITORS {totalCount > 0 ? `${assignedCount}/${totalCount}` : ''}
            </Text>
          </View>
          <Text style={styles.competitorsAll}>ALL</Text>
        </View>

        <ScrollView
          style={styles.competitorScroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled={competitors.length > 3}
        >
          <View style={styles.competitorList}>
            {competitors.length === 0 && (
              <Text style={styles.noCompetitors}>No competitors added</Text>
            )}
            {competitors.map((c) => {
              const elapsed = assignedMap.get(c.id);
              const assigned = elapsed !== undefined;
              return (
                <View
                  key={c.id}
                  style={[styles.competitorRow, assigned && styles.competitorRowAssigned]}
                >
                  <Text style={styles.competitorName}>{c.display_name}</Text>
                  <Text
                    style={assigned ? styles.competitorTimeAssigned : styles.competitorTimePending}
                  >
                    {assigned ? formatElapsed(elapsed).hms : '--:--:--'}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ── Screen flash overlay ── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.flashOverlay, { opacity: flashAnim }]}
      />

      {/* ── Assignment modal ── */}
      {pendingCapture !== null && (
        <>
          {/* Backdrop */}
          <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          </Animated.View>

          {/* Context label (sits above the sheet) */}
          {capturedElapsed && (
            <View style={[styles.contextLabelRow, { top: insets.top + 12 }]}>
              <View style={styles.contextLabelPill}>
                <View style={styles.contextDot} />
                <Text style={styles.contextLabelText}>
                  {capturedElapsed.hms} · TRIGGER ACTIVATED
                </Text>
              </View>
            </View>
          )}

          {/* Sheet */}
          <Animated.View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(36, insets.bottom + 16) },
              { transform: [{ translateY: modalSlide }] },
            ]}
          >
            {/* Handle */}
            <View style={styles.modalHandleRow}>
              <View style={styles.modalHandle} />
            </View>

            {/* Timestamp header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="zap" size={14} color={C.accent} />
                <Text style={styles.modalTitleText}>TIMESTAMP CAPTURED</Text>
              </View>
              {capturedElapsed && (
                <View style={styles.modalTimeRow}>
                  <Text style={styles.modalTimeHms}>{capturedElapsed.hms}</Text>
                  <Text style={styles.modalTimeCs}>{capturedElapsed.cs}</Text>
                </View>
              )}
              <Text style={styles.modalSubtitle}>Select a competitor to assign this time</Text>
            </View>

            {/* Pending competitors */}
            <Text style={styles.modalSectionLabel}>
              Pending · {pendingCompetitors.length} remaining
            </Text>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {pendingCompetitors.map((c) => (
                <View key={c.id} style={styles.modalCompetitorRow}>
                  <View style={styles.modalAvatar}>
                    <Text style={styles.modalAvatarText}>{getInitials(c.display_name)}</Text>
                  </View>
                  <Text style={styles.modalCompetitorName}>{c.display_name}</Text>
                  <TouchableOpacity
                    style={styles.assignBtn}
                    onPress={() => handleAssign(c.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.assignBtnText}>Assign</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {pendingCompetitors.length === 0 && (
                <Text style={styles.allAssignedText}>All competitors assigned</Text>
              )}
            </ScrollView>

            {/* Assignment error */}
            {assignError && (
              <View style={styles.assignErrorBox}>
                <Feather name="alert-triangle" size={12} color="#E05C5C" />
                <Text style={styles.assignErrorText}>{assignError}</Text>
              </View>
            )}

            {/* Discard */}
            <View style={styles.discardRow}>
              <TouchableOpacity style={styles.discardBtn} onPress={closeModal} activeOpacity={0.7}>
                <Feather name="x" size={14} color={C.textSecondary} />
                <Text style={styles.discardText}>DISCARD TIMESTAMP</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: C.bgBar,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accent,
  },
  liveText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.92, // 0.16em × 12px
    textTransform: 'uppercase',
    color: C.accent,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  finishText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.accent,
  },
  finishConfirmBtn: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(224,92,92,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.35)',
  },
  finishConfirmText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#E05C5C',
  },

  // ── Timer zone ──
  timerZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: C.bg,
  },
  modeToggles: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    gap: 8,
  },
  modeActiveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeInactiveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTooltip: {
    position: 'absolute',
    top: 50,
    right: 0,
    backgroundColor: C.bgCardAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  cameraTooltipText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textMuted,
  },
  sessionName: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 2.08,
    textTransform: 'uppercase',
    color: C.textSecondary,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    marginBottom: 12,
  },
  roleBadgeText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.accent,
  },
  elapsedLabel: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
    color: C.textSecondary,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  timerHms: {
    fontFamily: 'SpaceMono-Bold',
    fontSize: 64,
    letterSpacing: -1.28,
    color: C.accent,
    textShadowColor: C.accentTimerGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  timerCs: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 28,
    letterSpacing: 1.12,
    color: C.accentMs,
    marginTop: 4,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  queueBadgeText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.accent,
    textTransform: 'uppercase',
  },
  boltContainer: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  boltAura: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: C.accentAura,
  },
  boltButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 16,
  },

  // ── Competitors bar ──
  competitorsBar: {
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: C.bgBar,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  competitorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  competitorsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  competitorsLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    color: C.textSecondary,
  },
  competitorsAll: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.accent,
  },
  competitorScroll: {
    maxHeight: 120, // ~3 rows
  },
  competitorList: {
    gap: 6,
  },
  noCompetitors: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  competitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  competitorRowAssigned: {
    borderColor: C.accentAssignedBorder,
  },
  competitorName: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textPrimary,
    flex: 1,
  },
  competitorTimeAssigned: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: C.accent,
  },
  competitorTimePending: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: C.textMuted,
  },

  // ── Flash overlay ──
  flashOverlay: {
    backgroundColor: C.accentAura,
  },

  // ── Assignment modal ──
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  contextLabelRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  contextLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  contextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  contextLabelText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.textSecondary,
  },
  modalCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bgModal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  modalHandleRow: {
    alignItems: 'center',
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: C.textSecondary,
  },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  modalTimeHms: {
    fontFamily: 'SpaceMono-Bold',
    fontSize: 52,
    letterSpacing: -1.04,
    color: C.accent,
    textShadowColor: C.accentModalGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  modalTimeCs: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 22,
    color: C.accentMs2,
  },
  modalSubtitle: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 16,
  },
  modalSectionLabel: {
    fontFamily: 'Barlow-Regular',
    fontSize: 16,
    color: C.textSecondary,
    paddingTop: 14,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  modalScroll: {
    maxHeight: 260,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  modalCompetitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: C.bgCardAlt,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalAvatarText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    color: C.textMuted,
  },
  modalCompetitorName: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  assignBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: C.accent,
  },
  assignBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: '#000000',
    letterSpacing: 0.5,
  },
  allAssignedText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  assignErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)',
  },
  assignErrorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: '#E05C5C',
    flex: 1,
    lineHeight: 17,
  },
  discardRow: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  discardText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 1.12,
    textTransform: 'uppercase',
    color: C.textSecondary,
  },
});
