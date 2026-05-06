/**
 * Camera scrubber — manual timestamp via burst recording.
 *
 * ready → recording → scrub → confirm → back
 *
 * Operator presses START: frames are captured at ~15fps (shutterSound and
 * animateShutter both disabled). Each frame stores its URI and the exact
 * Date.now() at capture time. After STOP, the operator scrubs through frames
 * to pick the exact crossing moment. The confirmed timestamp is the stored
 * Date.now() for that frame, corrected by the NTP offset.
 *
 * NOTE: @react-native-community/slider is a native module — EAS Build is
 * required. This screen will not work in Expo Go.
 */

import { Feather } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts';
import { captureTimestamp } from '@/src/api/timestamps';
import { formatElapsedMs } from '@/src/utils';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#131313',
  bgCard: '#1A1819',
  accent: '#EDD83D',
  border: '#2A2728',
  textPrimary: '#E2DADB',
  textSecondary: '#6D696A',
  textMuted: '#A2A7A5',
  danger: '#E05252',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPTURE_INTERVAL_MS = 67; // ~15 fps — matches motion detector poll rate
const MAX_FRAMES = 225; // 15-second cap at 15fps

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'ready' | 'recording' | 'scrub';

interface CapturedFrame {
  uri: string;
  timestamp: number; // Date.now() at moment of capture
}

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
  const framesRef = useRef<CapturedFrame[]>([]);
  const captureActiveRef = useRef(false); // prevents overlapping takePictureAsync calls
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [frameCount, setFrameCount] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  function startRecording() {
    framesRef.current = [];
    captureActiveRef.current = false;
    setFrameCount(0);
    setPhase('recording');

    intervalRef.current = setInterval(async () => {
      if (captureActiveRef.current || !cameraRef.current) return;
      if (framesRef.current.length >= MAX_FRAMES) {
        finishRecording();
        return;
      }

      captureActiveRef.current = true;
      const timestamp = Date.now();
      try {
        const pic = await cameraRef.current.takePictureAsync({
          base64: false,
          quality: 0.3,
          shutterSound: false,
        });
        framesRef.current.push({ uri: pic.uri, timestamp });
        setFrameCount(framesRef.current.length);
      } catch {
        // frame lost — continue
      } finally {
        captureActiveRef.current = false;
      }
    }, CAPTURE_INTERVAL_MS);
  }

  function finishRecording() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const captured = [...framesRef.current];
    if (captured.length === 0) {
      setPhase('ready');
      return;
    }
    setFrames(captured);
    setSelectedIndex(0);
    setPhase('scrub');
  }

  function handleClose() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    router.back();
  }

  async function handleConfirm() {
    if (frames.length === 0 || !token || submitting) return;
    setSubmitting(true);

    const correctedMs = frames[selectedIndex].timestamp + ntpOffsetMs;

    try {
      await captureTimestamp(token, session_code, correctedMs, 'CAMERA');
    } catch {
      // best-effort; timing screen owns the offline queue
    } finally {
      setSubmitting(false);
      router.back();
    }
  }

  const selectedFrame = frames[selectedIndex];
  const elapsedMs = selectedFrame ? Math.max(0, selectedFrame.timestamp - sessionStartMs) : 0;

  const headerTitle =
    phase === 'ready'
      ? 'MANUAL CAPTURE'
      : phase === 'recording'
        ? `RECORDING · ${frameCount}`
        : 'SELECT FRAME';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        {phase === 'scrub' ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setPhase('ready')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="refresh-cw" size={16} color={C.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {/* ── Body ── */}
      {phase === 'scrub' ? (
        <View style={styles.scrubPhase}>
          {/* Frame viewer */}
          <View style={styles.frameWrap}>
            {selectedFrame && (
              <Image
                source={{ uri: selectedFrame.uri }}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
              />
            )}
            <View style={styles.frameBadge}>
              <Text style={styles.frameBadgeText}>
                {selectedIndex + 1} / {frames.length}
              </Text>
            </View>
          </View>

          {/* Timestamp for selected frame */}
          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>FRAME TIME</Text>
            <Text style={styles.timeValue}>{formatElapsedMs(elapsedMs)}</Text>
          </View>

          {/* Frame scrubber */}
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(0, frames.length - 1)}
            step={1}
            value={selectedIndex}
            onValueChange={(v) => setSelectedIndex(Math.round(v))}
            minimumTrackTintColor={C.accent}
            maximumTrackTintColor={C.border}
            thumbTintColor={C.accent}
          />
          <Text style={styles.sliderHint}>
            Drag to find the exact frame where the rider crossed the line
          </Text>

          {/* Confirm */}
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
      ) : (
        <View style={styles.recordPhase}>
          {/* Viewfinder — always mounted during ready/recording */}
          <View style={styles.viewfinderWrap}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
              animateShutter={false}
            />

            {phase === 'ready' && (
              <View style={styles.viewfinderOverlay}>
                <Text style={styles.viewfinderHint}>Frame the finish line, then tap START</Text>
              </View>
            )}

            {phase === 'recording' && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>REC</Text>
              </View>
            )}
          </View>

          {phase === 'ready' ? (
            <TouchableOpacity style={styles.startBtn} onPress={startRecording} activeOpacity={0.8}>
              <View style={styles.startDot} />
              <Text style={styles.startBtnText}>START RECORDING</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopBtn} onPress={finishRecording} activeOpacity={0.8}>
              <View style={styles.stopSquare} />
              <Text style={styles.stopBtnText}>STOP</Text>
            </TouchableOpacity>
          )}
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

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: {
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

  // ── Ready / Recording phase ──────────────────────────────────────────────────
  recordPhase: {
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
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  recordingBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  recordingText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: C.danger,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  startDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F0F0F',
  },
  startBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 2,
    color: '#0F0F0F',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.danger,
    borderRadius: 12,
    paddingVertical: 14,
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  stopBtnText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    letterSpacing: 2,
    color: '#fff',
  },

  // ── Scrub phase ──────────────────────────────────────────────────────────────
  scrubPhase: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  frameWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  frameBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  frameBadgeText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 12,
    letterSpacing: 1,
    color: C.textMuted,
  },
  timeCard: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  timeLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: C.textSecondary,
  },
  timeValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 28,
    color: C.textPrimary,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderHint: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
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
