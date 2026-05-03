import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { SessionStatus } from '@/src/api';

interface Props {
  status: SessionStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<
  SessionStatus,
  { label: string; bg: string; border: string; text: string; dot: string | null }
> = {
  DRAFT: {
    label: 'DRAFT',
    bg: 'rgba(162,167,165,0.07)',
    border: 'rgba(162,167,165,0.18)',
    text: '#A2A7A5',
    dot: null,
  },
  WAITING: {
    label: 'WAITING',
    bg: 'rgba(100,140,255,0.07)',
    border: 'rgba(100,140,255,0.25)',
    text: '#7B9FFF',
    dot: null,
  },
  ACTIVE: {
    label: 'LIVE',
    bg: 'rgba(76,175,138,0.08)',
    border: 'rgba(76,175,138,0.28)',
    text: '#4CAF8A',
    dot: '#4CAF8A',
  },
  FINISHED: {
    label: 'FINISHED',
    bg: 'rgba(109,105,106,0.06)',
    border: 'rgba(109,105,106,0.18)',
    text: '#6D696A',
    dot: null,
  },
};

export function SessionStatusBadge({ status, size = 'sm' }: Props) {
  const cfg = CONFIG[status];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'ACTIVE') {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulseAnim]);

  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
        isSm ? styles.badgeSm : styles.badgeMd,
      ]}
    >
      {cfg.dot && (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: cfg.dot, opacity: pulseAnim },
            isSm ? styles.dotSm : styles.dotMd,
          ]}
        />
      )}
      <Text style={[styles.label, { color: cfg.text }, isSm ? styles.labelSm : styles.labelMd]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 3, gap: 4 },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
  dot: { borderRadius: 50 },
  dotSm: { width: 5, height: 5 },
  dotMd: { width: 6, height: 6 },
  label: { fontFamily: 'BarlowCondensed-Bold' },
  labelSm: { fontSize: 10, letterSpacing: 1.4 },
  labelMd: { fontSize: 12, letterSpacing: 1.6 },
});
