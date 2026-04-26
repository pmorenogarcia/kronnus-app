import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  bg: '#0F0F0F',
  bgCard: '#1A1819',
  bgCardAlt: '#1E1C1D',
  accent: '#EDD83D',
  accentSubtle: 'rgba(237,216,61,0.08)',
  accentMid: 'rgba(237,216,61,0.15)',
  accentBorder: 'rgba(237,216,61,0.25)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
  live: '#EDD83D',
};

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; description: string }
> = {
  START: {
    label: 'START',
    icon: 'flag-outline',
    color: C.accent,
    description: 'Trigger when the competitor crosses the start line.',
  },
  SPLIT: {
    label: 'INTERMEDIATE',
    icon: 'timer-outline',
    color: '#A2A7A5',
    description: 'Trigger at the intermediate checkpoint.',
  },
  END: {
    label: 'FINISH',
    icon: 'flag-checkered',
    color: C.accent,
    description: 'Trigger when the competitor crosses the finish line.',
  },
};

export default function TimingScreen() {
  const insets = useSafeAreaInsets();
  const { role, session_code } = useLocalSearchParams<{
    role?: string;
    session_code?: string;
    session_name?: string;
  }>();

  const roleKey = role ?? 'START';
  const config = ROLE_CONFIG[roleKey] ?? ROLE_CONFIG['START'];

  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleTriggerPressIn() {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  function handleTriggerPressOut() {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>SESSION ACTIVE</Text>
        </View>
        {session_code ? <Text style={styles.sessionCode}>{session_code}</Text> : null}
      </View>

      {/* Role badge */}
      <View style={styles.roleSection}>
        <Text style={styles.roleSuperlabel}>YOUR CHECKPOINT</Text>
        <View style={styles.roleBadge}>
          <MaterialCommunityIcons
            name={config.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={22}
            color={config.color}
          />
          <Text style={[styles.roleLabel, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.roleDescription}>{config.description}</Text>
      </View>

      {/* Trigger button — fills available space */}
      <View style={styles.triggerArea}>
        <Animated.View style={[styles.triggerWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            style={styles.triggerBtn}
            activeOpacity={1}
            onPressIn={handleTriggerPressIn}
            onPressOut={handleTriggerPressOut}
            onPress={() => {
              // TODO: capture Date.now() and send checkpoint event via WebSocket
            }}
          >
            <MaterialCommunityIcons name="timer-outline" size={48} color="#0F0F0F" />
            <Text style={styles.triggerLabel}>TRIGGER</Text>
            <Text style={styles.triggerSub}>CHECKPOINT</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Bottom info bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.bottomItem}>
          <Text style={styles.bottomLabel}>MODE</Text>
          <Text style={styles.bottomValue}>BUTTON</Text>
        </View>
        <View style={styles.bottomSeparator} />
        <View style={styles.bottomItem}>
          <Text style={styles.bottomLabel}>TRIGGER</Text>
          <Text style={styles.bottomValue}>MANUAL</Text>
        </View>
        <View style={styles.bottomSeparator} />
        <View style={styles.bottomItem}>
          <Text style={styles.bottomLabel}>SYNC</Text>
          <Text style={[styles.bottomValue, styles.bottomValueAccent]}>PLACEHOLDER</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.live,
  },
  liveLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 2,
    color: C.live,
    textTransform: 'uppercase',
  },
  sessionCode: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
    color: C.textSecondary,
    letterSpacing: 1,
  },

  // Role section
  roleSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  roleSuperlabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSubtle,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  roleLabel: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 26,
    letterSpacing: 1.5,
  },
  roleDescription: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  // Trigger
  triggerArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerWrapper: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 340,
    maxHeight: 340,
  },
  triggerBtn: {
    flex: 1,
    backgroundColor: C.accent,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  triggerLabel: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 44,
    letterSpacing: 2,
    color: '#0F0F0F',
    lineHeight: 48,
  },
  triggerSub: {
    fontFamily: 'Barlow-Regular',
    fontSize: 13,
    letterSpacing: 3,
    color: 'rgba(0,0,0,0.5)',
    textTransform: 'uppercase',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: '#0A0A0A',
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bottomSeparator: {
    width: 1,
    height: 28,
    backgroundColor: C.border,
  },
  bottomLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  bottomValue: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 15,
    letterSpacing: 1,
    color: C.textPrimary,
  },
  bottomValueAccent: {
    color: C.textSecondary,
    fontSize: 12,
  },
});
