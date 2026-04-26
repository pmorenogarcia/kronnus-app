import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { useSessionWebSocket } from '@/src/hooks';

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

  const { sessionStarted, isConnected } = useSessionWebSocket({
    sessionId: session_id ?? '',
    token: token ?? '',
    enabled: !!session_id && !!token,
  });

  useEffect(() => {
    if (!sessionStarted) return;
    router.replace({
      pathname: '/(tabs)/timing' as any,
      params: { role: role ?? 'SPLIT', session_code: session_code ?? '' },
    });
  }, [sessionStarted, role, session_code]);

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

      {/* Content */}
      <View style={styles.content}>
        {/* Pulse ring indicator */}
        <View style={styles.pulseOuter}>
          <View style={styles.pulseInner}>
            <Feather name="clock" size={28} color={C.accent} />
          </View>
        </View>

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
              <Text style={[styles.infoCardValueAccent]}>
                {isConnected ? 'CONNECTED' : 'CONNECTING…'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.roleHintCard}>
          <Feather name="user-check" size={14} color={C.textSecondary} />
          <Text style={styles.roleHintText}>
            Your checkpoint role will be assigned by the organiser before the session starts.
          </Text>
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

  // Role hint
  roleHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: '100%',
  },
  roleHintText: {
    flex: 1,
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 20,
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
});
