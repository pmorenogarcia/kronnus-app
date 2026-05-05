import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Tabs, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { getSessionState, listCompetitors, listSessions } from '@/src/api';
import type { Competitor, Session } from '@/src/api';
import { CameraPermissionGate } from '@/src/components';
import { useCameraMotionDetector, useSessionSocket, useSettings } from '@/src/hooks';

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
  triggerType: 'BUTTON' | 'CAMERA';
}

// ─── Timing Portal (shown when tab is accessed without an active session) ────

type PortalPhase =
  | { kind: 'loading' }
  | { kind: 'waiting_coord'; session: Session }
  | { kind: 'waiting_op'; session: Session; role: string }
  | { kind: 'none' };

function TimingPortal() {
  const portalInsets = useSafeAreaInsets();
  const { token } = useAuth();
  const [phase, setPhase] = useState<PortalPhase>({ kind: 'loading' });

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let cancelled = false;

      async function detect() {
        try {
          const list = await listSessions(token!);
          if (cancelled) return;

          const active = list.find((s) => s.status === 'ACTIVE');
          if (active) {
            router.replace({
              pathname: '/(tabs)/timing' as never,
              params: {
                session_id: active.id,
                session_code: active.session_code,
                session_name: active.name,
                is_coordinator: 'true',
                offset_ms: '0',
              },
            });
            return;
          }

          const waiting = list.find((s) => s.status === 'WAITING');
          if (waiting) {
            setPhase({ kind: 'waiting_coord', session: waiting });
            return;
          }

          setPhase({ kind: 'none' });
        } catch {
          setPhase({ kind: 'none' });
        }
      }

      detect();
      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  const P = portalStyles;

  if (phase.kind === 'loading') {
    return (
      <View style={[P.root, { paddingTop: portalInsets.top }]}>
        <Tabs.Screen options={{ headerShown: false }} />
        <View style={P.centerWrap}>
          <ActivityIndicator color={portalC.accent} size="small" />
        </View>
      </View>
    );
  }

  if (phase.kind === 'waiting_coord') {
    const s = phase.session;
    return (
      <View style={[P.root, { paddingTop: portalInsets.top }]}>
        <Tabs.Screen options={{ headerShown: false }} />
        <View style={P.centerWrap}>
          <View style={P.card}>
            <View style={P.cardIcon}>
              <Feather name="clock" size={22} color={portalC.accent} />
            </View>
            <Text style={P.cardTitle}>{s.name.toUpperCase()}</Text>
            <Text style={P.cardSub}>Session is waiting — set up devices and start.</Text>
            <TouchableOpacity
              style={P.ctaBtn}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/session-setup' as never,
                  params: {
                    session_id: s.id,
                    session_code: s.session_code,
                    session_name: s.name,
                  },
                })
              }
            >
              <Text style={P.ctaBtnText}>OPEN SETUP</Text>
              <Feather name="arrow-right" size={14} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (phase.kind === 'waiting_op') {
    const s = phase.session;
    return (
      <View style={[P.root, { paddingTop: portalInsets.top }]}>
        <Tabs.Screen options={{ headerShown: false }} />
        <View style={P.centerWrap}>
          <View style={P.card}>
            <View style={P.cardIcon}>
              <Feather name="wifi" size={22} color={portalC.accent} />
            </View>
            <Text style={P.cardTitle}>{s.name.toUpperCase()}</Text>
            <Text style={P.cardSub}>Waiting for session to start — reconnect to your spot.</Text>
            <TouchableOpacity
              style={P.ctaBtn}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/waiting-room' as never,
                  params: {
                    session_id: s.id,
                    session_code: s.session_code,
                    role: phase.role,
                  },
                })
              }
            >
              <Text style={P.ctaBtnText}>RECONNECT</Text>
              <Feather name="arrow-right" size={14} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // none
  return (
    <View style={[P.root, { paddingTop: portalInsets.top }]}>
      <Tabs.Screen options={{ headerShown: false }} />
      <View style={P.centerWrap}>
        <Feather name="clock" size={32} color={portalC.textSecondary} />
        <Text style={P.noneTitle}>NO ACTIVE SESSION</Text>
        <Text style={P.noneSub}>Create or join a session from the Home tab to get started.</Text>
      </View>
    </View>
  );
}

const portalC = {
  bg: '#131313',
  bgCard: '#1A1819',
  accent: '#EDD83D',
  border: '#2A2728',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
};

const portalStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: portalC.bg },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  card: {
    width: '100%',
    backgroundColor: portalC.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: portalC.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(237,216,61,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(237,216,61,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1,
    color: portalC.textPrimary,
    textAlign: 'center',
  },
  cardSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: portalC.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: portalC.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  ctaBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 1.4,
    color: '#0F0F0F',
  },
  noneTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: portalC.textSecondary,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  noneSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: portalC.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimingScreen() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  if (!session_id) return <TimingPortal />;
  return <TimingContent />;
}

function TimingContent() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [validating, setValidating] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      if (!token || !session_id) {
        setValidating(false);
        return;
      }
      let cancelled = false;
      setValidating(true);

      // Coordinators own the session — verify via their session list.
      // Operators joined someone else's session — use getSessionState instead,
      // since listSessions only returns sessions the user created.
      const checkActive =
        is_coordinator === 'true'
          ? listSessions(token).then((list) =>
              list.some((s) => s.id === session_id && s.status === 'ACTIVE'),
            )
          : getSessionState(token, session_code ?? '').then(
              (state) => state.session.status === 'ACTIVE',
            );

      checkActive
        .then((isActive) => {
          if (cancelled) return;
          if (!isActive) {
            router.replace('/(tabs)/timing' as never);
          } else {
            setValidating(false);
          }
        })
        .catch(() => {
          if (!cancelled) setValidating(false);
        });
      return () => {
        cancelled = true;
      };
    }, [token, session_id, is_coordinator, session_code]),
  );

  const { settings } = useSettings();

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
  const navigatedRef = useRef(false);

  const navigateToResults = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setSessionEnded(true);
    router.replace({
      pathname: '/(tabs)/results' as never,
      params: { session_code: code },
    });
  }, [code]);

  useEffect(() => {
    if (lastMessage?.type === 'SESSION_END') {
      navigateToResults();
    }
  }, [lastMessage, navigateToResults]);

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
    captureTimestamp(token, code, item.capturedAtMs, item.triggerType)
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

    if (settings.soundEffects) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();

    if (!token) return;

    try {
      const ts = await captureTimestamp(token, code, capturedAtMs);
      openModal({ timestamp: ts, capturedAtMs });
    } catch {
      setQueue((prev) => [...prev, { capturedAtMs, triggerType: 'BUTTON' }]);
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
    navigateToResults();
  }

  useEffect(
    () => () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    [],
  );

  // ─── Camera mode ──────────────────────────────────────────────────────────

  const [triggerMode, setTriggerMode] = useState<'button' | 'camera'>('button');
  const [showPermissionGate, setShowPermissionGate] = useState(false);
  const [scrubberOpen, setScrubberOpen] = useState(false);
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const permissionSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [cameraPermission] = useCameraPermissions();
  const cameraGranted = cameraPermission?.granted ?? false;

  async function handleCameraCapture(capturedAtMs: number) {
    const correctedAtMs = capturedAtMs + offsetMs;

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();

    if (!token) return;

    try {
      const ts = await captureTimestamp(token, code, correctedAtMs, 'CAMERA');
      openModal({ timestamp: ts, capturedAtMs: correctedAtMs });
    } catch {
      setQueue((prev) => [...prev, { capturedAtMs: correctedAtMs, triggerType: 'CAMERA' }]);
    }
  }

  const { ref: cameraRef, isArmed } = useCameraMotionDetector({
    enabled: triggerMode === 'camera' && !scrubberOpen,
    sensitivity,
    cooldownMs: 2000,
    onTrigger: handleCameraCapture,
  });

  function handleManualPress() {
    setScrubberOpen(true);
    router.push({
      pathname: '/camera-scrubber' as never,
      params: {
        session_code: code,
        ntp_offset_ms: String(offsetMs),
        session_start_ms: String(sessionStartMs),
      },
    });
  }

  function openPermissionGate() {
    setShowPermissionGate(true);
    Animated.spring(permissionSlide, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }

  function closePermissionGate() {
    Animated.timing(permissionSlide, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setShowPermissionGate(false));
  }

  function handleCameraPress() {
    if (cameraGranted) {
      setTriggerMode('camera');
    } else {
      openPermissionGate();
    }
  }

  function handleButtonModePress() {
    setTriggerMode('button');
  }

  // Keep-awake: prevent screen sleep in camera mode. Camera is NEVER active in button mode —
  // important for battery and thermal management; always deactivate on mode switch or unmount.
  useEffect(() => {
    if (triggerMode !== 'camera') return;
    void activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
    };
  }, [triggerMode]);

  // Re-arm detection when the scrubber modal closes and this screen regains focus
  useFocusEffect(
    useCallback(() => {
      setScrubberOpen(false);
    }, []),
  );

  // ─── Derived ──────────────────────────────────────────────────────────────

  const assignedCount = assignedMap.size;
  const totalCount = competitors.length;
  const pendingCompetitors = competitors.filter((c) => !assignedMap.has(c.id));
  const capturedElapsed = pendingCapture
    ? formatElapsed(pendingCapture.capturedAtMs - sessionStartMs)
    : null;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (validating) {
    return (
      <View style={[styles.root, styles.validatingWrap]}>
        <Tabs.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={C.accent} size="small" />
      </View>
    );
  }

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
        {/* Live camera feed — only mounted in camera mode to conserve battery and heat */}
        {triggerMode === 'camera' && (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
        )}

        {/* Manual scrubber — absolute top-left, only visible in camera mode */}
        {triggerMode === 'camera' && (
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={handleManualPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="edit-2" size={14} color={C.textMuted} />
            <Text style={styles.manualBtnText}>MANUAL</Text>
          </TouchableOpacity>
        )}

        {/* Mode toggles — absolute top-right, always above camera feed */}
        <View style={styles.modeToggles}>
          <TouchableOpacity
            style={triggerMode === 'button' ? styles.modeActiveBtn : styles.modeInactiveBtn}
            onPress={handleButtonModePress}
            activeOpacity={0.7}
          >
            <Feather
              name="circle"
              size={20}
              color={triggerMode === 'button' ? '#0F0F0F' : C.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={triggerMode === 'camera' ? styles.modeActiveBtn : styles.modeInactiveBtn}
            onPress={handleCameraPress}
            activeOpacity={0.7}
          >
            <Feather
              name="camera"
              size={20}
              color={triggerMode === 'camera' ? '#0F0F0F' : C.textMuted}
            />
          </TouchableOpacity>
        </View>

        {triggerMode === 'button' ? (
          <>
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
          </>
        ) : (
          /* Camera mode overlay — centered content above the live feed */
          <View style={styles.cameraOverlay}>
            <Text style={styles.sessionName} numberOfLines={1}>
              {sessionName.toUpperCase()}
            </Text>

            {role ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{role}</Text>
              </View>
            ) : null}

            {/* Timer in a semi-transparent pill */}
            <View style={styles.cameraTimerPill}>
              <Text style={styles.elapsedLabel}>ELAPSED TIME</Text>
              <View style={styles.timerRow}>
                <Text style={styles.timerHms}>{hms}</Text>
                <Text style={styles.timerCs}>{cs}</Text>
              </View>
            </View>

            {/* Armed indicator — visible only after baseline warm-up completes */}
            {isArmed && (
              <View style={styles.armedIndicator}>
                <View style={styles.armedDot} />
                <Text style={styles.armedText}>ARMED</Text>
              </View>
            )}

            {/* Three-segment sensitivity control */}
            <View style={styles.sensitivityToggle}>
              {(['low', 'medium', 'high'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sensitivityBtn, sensitivity === s && styles.sensitivityBtnActive]}
                  onPress={() => setSensitivity(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sensitivityText,
                      sensitivity === s && styles.sensitivityTextActive,
                    ]}
                  >
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Queue badge */}
            {queue.length > 0 && (
              <View style={styles.queueBadge}>
                <Feather name="clock" size={11} color={C.accent} />
                <Text style={styles.queueBadgeText}>{queue.length} queued</Text>
              </View>
            )}
          </View>
        )}
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

      {/* ── Permission gate (slides up from bottom on camera toggle press) ── */}
      {showPermissionGate && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: permissionSlide }] }]}
        >
          <CameraPermissionGate
            onGranted={() => {
              closePermissionGate();
              setTriggerMode('camera');
            }}
            onDenied={closePermissionGate}
          />
        </Animated.View>
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
  validatingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
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
  manualBtn: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  manualBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textMuted,
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
  // ── Camera overlay ──
  cameraOverlay: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraTimerPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 4,
  },
  armedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  armedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#52C97B',
  },
  armedText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: '#52C97B',
  },
  sensitivityToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sensitivityBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  sensitivityBtnActive: {
    backgroundColor: C.accent,
  },
  sensitivityText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: C.textMuted,
  },
  sensitivityTextActive: {
    color: '#0F0F0F',
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
