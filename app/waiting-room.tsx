import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import type { CheckpointRole } from '@/src/api';
import { useSessionSocket, useTimeSync } from '@/src/hooks';
import type { SocketStatus } from '@/src/hooks';

function getUserIdFromToken(token: string): string {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload)) as { sub?: string };
    return decoded.sub ?? '';
  } catch {
    return '';
  }
}

function statusDisplay(s: SocketStatus): string {
  if (s === 'connected') return 'CONNECTED';
  if (s === 'error') return 'ERROR';
  return 'CONNECTING…';
}

const C = {
  bg: '#131313',
  bgHeader: '#0F0F0F',
  bgCard: '#1A1819',
  accent: '#EDD83D',
  accentSubtle: 'rgba(237,216,61,0.08)',
  accentBorder: 'rgba(237,216,61,0.2)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
};

export default function WaitingRoomScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { session_id, session_code, role } = useLocalSearchParams<{
    session_id: string;
    session_code: string;
    role: string;
  }>();

  const userId = useMemo(() => (token ? getUserIdFromToken(token) : ''), [token]);

  const socket = useSessionSocket(session_id ?? null);
  const { status, sessionStarted, lastMessage } = socket;

  const { synced, syncInProgress, getCorrectedTimestamp, offsetMs } = useTimeSync(socket, userId);

  const getCorrectedTimestampRef = useRef(getCorrectedTimestamp);
  getCorrectedTimestampRef.current = getCorrectedTimestamp;
  const offsetMsRef = useRef(offsetMs);
  offsetMsRef.current = offsetMs;

  const isConnected = status === 'connected';

  const pulseOpacity = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const bannerHeight = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const bannerAnimStyle = useAnimatedStyle(() => ({
    height: bannerHeight.value,
  }));

  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const [sessionEnded, setSessionEnded] = useState(false);
  const [assignedRole, setAssignedRole] = useState<CheckpointRole | null>(null);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'ROLE_ASSIGNED') return;
    if (lastMessage.payload.user_id !== userId) return;
    setAssignedRole(lastMessage.payload.role);
  }, [lastMessage, userId]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'SESSION_END') return;
    setSessionEnded(true);
    const timer = setTimeout(() => router.replace('/(tabs)'), 2000);
    return () => clearTimeout(timer);
  }, [lastMessage]);

  useEffect(() => {
    if (!sessionStarted) return;
    router.replace({
      pathname: '/(tabs)/timing' as any,
      params: {
        role: assignedRole ?? role ?? 'SPLIT',
        session_code: session_code ?? '',
        session_id: session_id ?? '',
        session_start_ms: String(getCorrectedTimestampRef.current()),
        offset_ms: String(offsetMsRef.current ?? 0),
        is_coordinator: 'false',
      },
    });
  }, [sessionStarted, assignedRole, role, session_code, session_id]);

  useEffect(() => {
    if (sessionEnded) {
      overlayOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [sessionEnded]);

  useEffect(() => {
    const target = status === 'error' && !sessionEnded ? 40 : 0;
    bannerHeight.value = withTiming(target, { duration: 300 });
  }, [status, sessionEnded]);

  useEffect(() => {
    if (isConnected) {
      pulseOpacity.value = withRepeat(
        withTiming(0.25, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      pulseScale.value = withRepeat(
        withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(1, { duration: 300 });
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [isConnected]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={18} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>WAITING ROOM</Text>
          <Text style={styles.headerSub}>KRONNUS</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Connection banner */}
      <Animated.View style={[styles.connectionBanner, bannerAnimStyle]}>
        <Text style={styles.connectionBannerText}>Connection lost — reconnecting...</Text>
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {/* Pulse ring indicator */}
        <Animated.View style={[styles.pulseOuter, pulseAnimStyle]}>
          <View style={styles.pulseInner}>
            <Feather name="clock" size={28} color={C.accent} />
          </View>
        </Animated.View>

        <Text style={styles.statusLabel}>WAITING FOR SESSION</Text>
        <Text style={styles.statusHeading}>Waiting for session{'\n'}to start</Text>
        <Text style={styles.statusBody}>
          The session organiser will start the timing when all operators are ready.
        </Text>

        {/* Info cards */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>SESSION CODE</Text>
            <Text style={styles.infoCardValue}>{session_code ?? '——'}</Text>
          </View>
          <View style={[styles.infoCard, styles.infoCardAccent]}>
            <Text style={styles.infoCardLabel}>STATUS</Text>
            <View style={styles.connectionRow}>
              <View style={[styles.connectionDot, isConnected && styles.connectionDotActive]} />
              <Text style={[styles.infoCardValueAccent]}>{statusDisplay(status)}</Text>
            </View>
          </View>
        </View>

        {/* Sync status */}
        <View style={styles.syncCard}>
          {syncInProgress && !synced ? (
            <>
              <ActivityIndicator size="small" color={C.textSecondary} />
              <Text style={styles.syncText}>Synchronising...</Text>
            </>
          ) : synced ? (
            <>
              <Feather name="check" size={14} color={C.accent} />
              <Text style={[styles.syncText, styles.syncTextDone]}>Synchronised</Text>
            </>
          ) : (
            <Text style={styles.syncTextMuted}>—</Text>
          )}
        </View>

        {/* Checkpoint role */}
        <View style={[styles.roleCard, assignedRole !== null && styles.roleCardAssigned]}>
          <Feather name="user-check" size={14} color={assignedRole ? C.accent : C.textSecondary} />
          {assignedRole ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{assignedRole}</Text>
            </View>
          ) : (
            <Text style={styles.roleHintText}>Waiting for role assignment...</Text>
          )}
        </View>
      </View>

      {/* Leave button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={16} color={C.textMuted} />
          <Text style={styles.leaveBtnText}>LEAVE SESSION</Text>
        </TouchableOpacity>
      </View>
      {sessionEnded && (
        <Animated.View style={[styles.sessionEndOverlay, overlayAnimStyle]}>
          <Text style={styles.sessionEndText}>Session ended</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.5,
    color: C.textPrimary,
    textTransform: 'uppercase',
  },
  headerSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },

  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  pulseOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pulseInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(237,216,61,0.1)',
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 3,
    color: C.textSecondary,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statusHeading: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 34,
    letterSpacing: 0.4,
    color: C.textPrimary,
    textAlign: 'center',
    lineHeight: 38,
  },
  statusBody: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  infoCard: {
    flex: 1,
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
  },
  infoCardAccent: {
    backgroundColor: C.accentSubtle,
    borderColor: C.accentBorder,
  },
  infoCardLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  infoCardValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 18,
    color: C.textPrimary,
    letterSpacing: 1,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.textSecondary,
  },
  connectionDotActive: {
    backgroundColor: C.accent,
  },
  infoCardValueAccent: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 15,
    color: C.accent,
    letterSpacing: 1,
  },
  connectionBanner: {
    overflow: 'hidden',
    backgroundColor: '#3A2020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionBannerText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: '#E07070',
    letterSpacing: 0.4,
  },

  // Role hint text (reused inside role card)
  roleHintText: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 20,
  },

  // Sync card
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: '100%',
  },
  syncText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textMuted,
  },
  syncTextDone: {
    fontFamily: 'BarlowCondensed-Bold',
    color: C.accent,
  },
  syncTextMuted: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textSecondary,
  },

  // Role card
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: '100%',
  },
  roleCardAssigned: {
    backgroundColor: C.accentSubtle,
    borderColor: C.accentBorder,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  roleBadgeText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 14,
    letterSpacing: 1.5,
    color: C.accent,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  leaveBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  sessionEndOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    zIndex: 100,
  },
  sessionEndText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 28,
    letterSpacing: 2,
    color: '#E2DADB',
    textTransform: 'uppercase',
  },
});
