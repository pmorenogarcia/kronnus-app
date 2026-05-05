import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useCameraPermission } from '@/src/hooks';

const C = {
  bg: '#0F0F0F',
  bgCard: '#1A1819',
  accent: '#EDD83D',
  accentBg: 'rgba(237,216,61,0.10)',
  accentBorder: 'rgba(237,216,61,0.22)',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  border: '#2A2728',
};

interface Props {
  onGranted: () => void;
  onDenied: () => void;
}

export function CameraPermissionGate({ onGranted, onDenied }: Props) {
  const { granted, requesting } = useCameraPermission();

  if (requesting) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (granted) {
    onGranted();
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Feather name="camera-off" size={28} color={C.accent} />
        </View>

        <Text style={styles.title}>CAMERA ACCESS REQUIRED</Text>
        <Text style={styles.body}>
          Camera access is required for this mode. Enable it in your device settings.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => Linking.openSettings()}
          activeOpacity={0.85}
        >
          <Feather name="settings" size={16} color="#0F0F0F" />
          <Text style={styles.primaryBtnText}>OPEN SETTINGS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onDenied} activeOpacity={0.7}>
          <Text style={styles.secondaryBtnText}>USE BUTTON MODE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: C.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 20,
    letterSpacing: 1.2,
    color: C.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Barlow-Regular',
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderRadius: 12,
    height: 52,
    width: '100%',
    gap: 10,
  },
  primaryBtnText: {
    fontFamily: 'BarlowCondensed-Black',
    fontSize: 15,
    letterSpacing: 1.5,
    color: '#0F0F0F',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    height: 48,
    width: '100%',
  },
  secondaryBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 1.4,
    color: C.textSecondary,
  },
});
