/**
 * Camera scrubber — manual timestamp via video recording.
 *
 * ready → recording → scrub → confirm → back
 *
 * The operator records a short clip at the device's native frame rate (~30fps).
 * recordingStartMs is snapped at the call site. After STOP the scrub phase
 * opens instantly — no frame extraction. An expo-video player shows the clip
 * paused; dragging the slider sets player.currentTime so the operator can
 * identify the exact crossing frame. Confirmed timestamp =
 * recordingStartMs + seekMs + ntpOffsetMs.
 *
 * NOTE: expo-camera and expo-video are native modules — EAS Build required.
 */

import { Feather } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captureTimestamp } from '@/src/api/timestamps';
import { formatElapsedMs, setPendingCameraTimestamp } from '@/src/utils';

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

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'ready' | 'recording' | 'scrub';

interface RecordedClip {
  uri: string;
  durationMs: number;
  startMs: number;
}

// ─── ScrubView (sub-component — only mounted when clip is available) ──────────

interface ScrubViewProps {
  clip: RecordedClip;
  ntpOffsetMs: number;
  sessionStartMs: number;
  sessionCode: string;
  onRetake: () => void;
  onClose: () => void;
}

function ScrubView({
  clip,
  ntpOffsetMs,
  sessionStartMs,
  sessionCode,
  onRetake,
  onClose,
}: ScrubViewProps) {
  const player = useVideoPlayer(clip.uri, (p) => {
    p.muted = true;
    p.loop = false;
    p.pause();
  });

  const [seekMs, setSeekMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Apply NTP offset for display only; raw timestamp is sent to API (server corrects).
  const elapsedMs = Math.max(0, clip.startMs + ntpOffsetMs + seekMs - sessionStartMs);

  function handleSlidingStart() {
    player.scrubbingModeOptions = { scrubbingModeEnabled: true };
  }

  function handleValueChange(v: number) {
    const ms = Math.round(v);
    setSeekMs(ms);
    player.currentTime = ms / 1000;
  }

  function handleSlidingComplete(v: number) {
    const ms = Math.round(v);
    setSeekMs(ms);
    player.currentTime = ms / 1000;
    player.scrubbingModeOptions = { scrubbingModeEnabled: false };
  }

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    // Snapshot seekMs before the await so correctedMs and displayMs are consistent
    // even if the slider is moved while the request is in flight.
    const snapshotMs = seekMs;
    const correctedMs = clip.startMs + snapshotMs; // raw — server applies NTP offset
    try {
      const ts = await captureTimestamp(sessionCode, correctedMs, 'CAMERA');
      const displayMs = clip.startMs + snapshotMs + ntpOffsetMs;
      setPendingCameraTimestamp({ timestamp: ts, capturedAtMs: displayMs });
      onClose(); // navigate back only on success
    } catch {
      // Keep the scrubber open so the operator can retry — don't silently discard.
      setSubmitting(false);
      setSubmitError('Could not save timestamp — check connection and try again.');
    }
  }

  return (
    <View style={styles.scrubPhase}>
      {/* Video viewer */}
      <View style={styles.frameWrap}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          nativeControls={false}
        />
        <View style={styles.frameBadge}>
          <Text style={styles.frameBadgeText}>
            {formatElapsedMs(seekMs)} / {formatElapsedMs(clip.durationMs)}
          </Text>
        </View>
      </View>

      {/* Timestamp for selected position */}
      <View style={styles.timeCard}>
        <Text style={styles.timeLabel}>FRAME TIME</Text>
        <Text style={styles.timeValue}>{formatElapsedMs(elapsedMs)}</Text>
      </View>

      {/* Seek scrubber */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={clip.durationMs}
        step={1}
        value={seekMs}
        onSlidingStart={handleSlidingStart}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={C.accent}
        maximumTrackTintColor={C.border}
        thumbTintColor={C.accent}
      />
      <Text style={styles.sliderHint}>
        Drag to find the exact moment the rider crossed the line
      </Text>

      {/* API error — shown inline so the operator can retry without losing the clip */}
      {submitError && (
        <View style={styles.errorBox}>
          <Feather name="alert-triangle" size={12} color={C.danger} />
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      )}

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
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CameraScrubberScreen() {
  const insets = useSafeAreaInsets();

  const { session_code, ntp_offset_ms, session_start_ms } = useLocalSearchParams<{
    session_code: string;
    ntp_offset_ms: string;
    session_start_ms: string;
  }>();

  const ntpOffsetMs = Number(ntp_offset_ms ?? 0);
  const sessionStartMs = Number(session_start_ms ?? 0);

  const cameraRef = useRef<CameraView>(null);
  const recordingStartMsRef = useRef(0);
  const stopMsRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('ready');
  const [clip, setClip] = useState<RecordedClip | null>(null);

  function startRecording() {
    if (!cameraRef.current) return;
    recordingStartMsRef.current = Date.now();
    setPhase('recording');

    cameraRef.current
      .recordAsync({ maxDuration: 15 })
      .then((result) => {
        if (!result) {
          setPhase('ready');
          return;
        }
        const durationMs = Math.max(stopMsRef.current - recordingStartMsRef.current, 1000);
        setClip({ uri: result.uri, durationMs, startMs: recordingStartMsRef.current });
        setPhase('scrub');
      })
      .catch(() => setPhase('ready'));
  }

  function stopRecording() {
    stopMsRef.current = Date.now();
    cameraRef.current?.stopRecording();
  }

  function handleClose() {
    if (phase === 'recording') stopRecording();
    router.back();
  }

  function handleRetake() {
    setClip(null);
    setPhase('ready');
  }

  const headerTitle =
    phase === 'ready' ? 'MANUAL CAPTURE' : phase === 'recording' ? 'RECORDING' : 'SELECT FRAME';

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
            onPress={handleRetake}
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
      {phase === 'scrub' && clip ? (
        <ScrubView
          clip={clip}
          ntpOffsetMs={ntpOffsetMs}
          sessionStartMs={sessionStartMs}
          sessionCode={session_code}
          onRetake={handleRetake}
          onClose={() => router.back()}
        />
      ) : (
        <View style={styles.recordPhase}>
          {/* Viewfinder — always mounted during ready/recording */}
          <View style={styles.viewfinderWrap}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
              mode="video"
              animateShutter={false}
              mute
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
            <TouchableOpacity style={styles.stopBtn} onPress={stopRecording} activeOpacity={0.8}>
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(224,82,82,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224,82,82,0.25)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: 'Barlow-Regular',
    fontSize: 12,
    color: C.danger,
    flex: 1,
    lineHeight: 17,
  },
});
