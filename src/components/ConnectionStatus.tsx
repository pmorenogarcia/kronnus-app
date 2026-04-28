import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

import type { SocketStatus } from '@/src/hooks/useSessionSocket';

const C = {
  accent: '#EDD83D',
  accentGlow: 'rgba(237,216,61,0.20)',
  error: '#E05C5C',
  errorGlow: 'rgba(224,92,92,0.15)',
  textPrimary: '#E2DADB',
  textMuted: '#6D696A',
};

interface ConnectionStatusProps {
  status: SocketStatus;
  error?: string | null;
}

export function ConnectionStatus({ status, error }: ConnectionStatusProps) {
  const pulseScale = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status !== 'connected') {
      pulseScale.setValue(0);
      pulseOpacity.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0.7,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
      pulseScale.setValue(0);
      pulseOpacity.setValue(0);
    };
  }, [status, pulseScale, pulseOpacity]);

  const ringScale = pulseScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  if (status === 'connected') {
    return (
      <View style={styles.row}>
        <View style={styles.dotWrapper}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ringScale }],
                opacity: pulseOpacity,
              },
            ]}
          />
          <View style={styles.dot} />
        </View>
        <Text style={styles.label}>LIVE</Text>
      </View>
    );
  }

  if (status === 'connecting') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size={10} color={C.accent} style={styles.spinner} />
        <Text style={[styles.label, styles.labelMuted]}>RECONNECTING...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.row}>
        <View style={styles.errorIconWrapper}>
          <Feather name="alert-triangle" size={11} color={C.error} />
        </View>
        <Text style={[styles.label, styles.labelError]}>{error ?? 'CONNECTION LOST'}</Text>
      </View>
    );
  }

  // disconnected — minimal indicator
  return (
    <View style={styles.row}>
      <View style={[styles.dot, styles.dotOff]} />
      <Text style={[styles.label, styles.labelMuted]}>DISCONNECTED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accent,
    position: 'absolute',
  },
  dotOff: {
    backgroundColor: '#3A3738',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accentGlow,
  },
  spinner: {
    width: 10,
    height: 10,
  },
  errorIconWrapper: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1.9,
    color: C.accent,
  },
  labelMuted: {
    color: C.textMuted,
  },
  labelError: {
    color: C.error,
  },
});
