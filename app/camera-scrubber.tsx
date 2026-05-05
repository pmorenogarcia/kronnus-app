/**
 * Camera scrubber — manual fallback for operators when automatic motion
 * detection is unreliable (e.g. poor or uneven lighting).
 *
 * Precision trade-off: frame-rate-limited detection has a ~33–67ms uncertainty
 * window (one 15-fps poll interval). The scrubber lets the operator capture a
 * still frame to establish a reference point and then shift the recorded
 * timestamp within ±500ms using the slider. This is less accurate than a
 * well-lit automatic trigger but more accurate than relying on a degraded
 * automatic trigger.
 *
 * NOTE: @react-native-community/slider is a native module — EAS Build is
 * required. This screen will not work in Expo Go.
 */

import { Feather } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { captureTimestamp } from '@/src/api/timestamps';
import { applyManualOffset, formatElapsedMs, formatOffsetLabel } from '@/src/utils';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgCard: '#1A1819',
  accent: '#EDD83D',
  accentBg: '#EDD83D14',
  border: '#2A2728',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CameraScrubberScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const { session_code, ntp_offset_ms, session_start_ms } = useLocalSearchParams<{
    session_code: string;
    ntp_offset_ms: string;
    session_start_ms: string;
  }>();

  const ntpOffsetMs = Number(ntp_offset_ms ?? 0);
  const sessionStartMs = Number(session_start_ms ?? 0);

  const cameraRef = useRef<CameraView>(null);

  // Phase: 'capture' shows the viewfinder; 'adjust' shows the slider UI
  const [phase, setPhase] = useState<'capture' | 'adjust'>('capture');
  const [capturedAtMs, setCapturedAtMs] = useState<number | null>(null);
  const [sliderOffset, setSliderOffset] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCapture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    // Record the timestamp synchronously before the async IO
    const now = Date.now();
    try {
      await cameraRef.current.takePictureAsync({ base64: false, quality: 0.1 });
    } catch {
      // ignore — photo is only used to force a shutter moment; the timestamp is what matters
    }
    setCapturedAtMs(now);
    setPhase('adjust');
    setCapturing(false);
  }

  async function handleConfirm() {
    if (capturedAtMs === null || !token || submitting) return;
    setSubmitting(true);

    const adjustedMs = applyManualOffset(capturedAtMs, sliderOffset);
    const correctedMs = applyManualOffset(adjustedMs, ntpOffsetMs);

    try {
      await captureTimestamp(token, session_code, correctedMs, 'CAMERA');
    } catch {
      // best-effort — the caller (timing screen) owns the offline queue;
      // the scrubber is a manual override path with the operator present
    } finally {
      setSubmitting(false);
      router.back();
    }
  }

  const adjustedElapsedMs =
    capturedAtMs !== null ? applyManualOffset(capturedAtMs, sliderOffset) - sessionStartMs : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MANUAL CAPTURE</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Body ── */}
      {phase === 'capture' ? (
        <View style={styles.capturePhase}>
          {/* Viewfinder */}
          <View style={styles.viewfinderWrap}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
            <View style={styles.viewfinderOverlay}>
              <Text style={styles.viewfinderHint}>Frame the finish line, then tap CAPTURE</Text>
            </View>
          </View>

          {/* Capture button */}
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            activeOpacity={0.8}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#0F0F0F" size="small" />
            ) : (
              <>
                <Feather name="camera" size={16} color="#0F0F0F" />
                <Text style={styles.captureBtnText}>CAPTURE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.adjustPhase}>
          {/* Elapsed time display */}
          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>ADJUSTED TIME</Text>
            <Text style={styles.timeValue}>{formatElapsedMs(Math.max(0, adjustedElapsedMs))}</Text>
            <Text style={styles.offsetLabel}>{formatOffsetLabel(sliderOffset)}</Text>
          </View>

          {/* Slider */}
          <View style={styles.sliderSection}>
            <Text style={styles.sliderBoundLabel}>−500ms</Text>
            <Slider
              style={styles.slider}
              minimumValue={-500}
              maximumValue={500}
              step={10}
              value={sliderOffset}
              onValueChange={(v) => setSliderOffset(v)}
              minimumTrackTintColor={C.accent}
              maximumTrackTintColor={C.border}
              thumbTintColor={C.accent}
            />
            <Text style={styles.sliderBoundLabel}>+500ms</Text>
          </View>

          <Text style={styles.sliderHint}>
            Slide to correct for reaction time or detection delay
          </Text>

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0F0F0F" size="small" />
            ) : (
              <>
                <Feather name="check" size={16} color="#0F0F0F" />
                <Text style={styles.confirmBtnText}>CONFIRM TIMESTAMP</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: C.textPrimary,
  },

  // ── Capture phase ──────────────────────────────────────────────────────────

  capturePhase: {
    flex: 1,
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  viewfinderWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
  viewfinderHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 2,
    color: '#0F0F0F',
  },

  // ── Adjust phase ───────────────────────────────────────────────────────────

  adjustPhase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 28,
  },
  timeCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 32,
    paddingVertical: 20,
    width: '100%',
  },
  timeLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
  },
  timeValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 32,
    color: C.textPrimary,
  },
  offsetLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    letterSpacing: 1,
    color: C.accent,
    marginTop: 2,
  },
  sliderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  sliderBoundLabel: {
    fontFamily: 'Barlow-Regular',
    fontSize: 11,
    color: C.textMuted,
    minWidth: 42,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 36,
  },
  sliderHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 2,
    color: '#0F0F0F',
  },
});
