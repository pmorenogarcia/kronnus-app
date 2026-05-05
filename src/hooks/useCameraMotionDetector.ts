/*
 * expo-camera SDK 55 managed workflow does not expose frame processors
 * (those require a custom dev client build and react-native-vision-camera).
 * Fallback: poll at ~15 fps via takePictureAsync and analyse the raw JPEG bytes
 * as a brightness proxy.
 *
 * Timestamp precision note: Date.now() is captured synchronously at the moment
 * the luminance drop is detected, before any state update or re-render. The
 * caller must apply the NTP offset correction returned by useTimeSync.
 */

import { useEffect, useRef, useState } from 'react';

import { CameraView } from 'expo-camera';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseCameraMotionDetectorOptions {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  cooldownMs: number;
  onTrigger: (capturedAtMs: number) => void;
}

export interface UseCameraMotionDetectorReturn {
  ref: React.RefObject<CameraView>;
  isArmed: boolean;
  lastLuminance: number | null;
  baselineLuminance: number | null;
}

// ─── Pure calculation functions (exported for unit testing) ───────────────────

/**
 * Estimates average image brightness from a raw byte buffer (JPEG binary or
 * any byte sequence). Samples every 4th byte to reduce computation at 15 fps.
 * Returns 0 for empty input.
 */
export function computeAverageLuminance(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
    count++;
  }
  return sum / count;
}

/**
 * Returns true when `current` brightness has dropped below `baseline × threshold`,
 * indicating a significant luminance change (competitor blocking the camera).
 */
export function isMotionDetected(current: number, baseline: number, threshold: number): boolean {
  return current < baseline * threshold;
}

// ─── Hook internals ───────────────────────────────────────────────────────────

const SENSITIVITY_THRESHOLDS: Record<UseCameraMotionDetectorOptions['sensitivity'], number> = {
  low: 0.85,
  medium: 0.78,
  high: 0.7,
};

const BASELINE_SIZE = 10;
const POLL_INTERVAL_MS = 67; // ~15 fps

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCameraMotionDetector(
  options: UseCameraMotionDetectorOptions,
): UseCameraMotionDetectorReturn {
  const { enabled } = options;

  const ref = useRef<CameraView>(null);
  const [isArmed, setIsArmed] = useState(false);
  const [lastLuminance, setLastLuminance] = useState<number | null>(null);
  const [baselineLuminance, setBaselineLuminance] = useState<number | null>(null);

  const frameBufferRef = useRef<number[]>([]);
  const isArmedRef = useRef(false);
  const lastTriggerTimeRef = useRef<number>(0);

  // Stable refs so the interval closure always reads the latest values
  const sensitivityRef = useRef(options.sensitivity);
  const cooldownMsRef = useRef(options.cooldownMs);
  const onTriggerRef = useRef(options.onTrigger);

  useEffect(() => {
    sensitivityRef.current = options.sensitivity;
  }, [options.sensitivity]);
  useEffect(() => {
    cooldownMsRef.current = options.cooldownMs;
  }, [options.cooldownMs]);
  useEffect(() => {
    onTriggerRef.current = options.onTrigger;
  }, [options.onTrigger]);

  useEffect(() => {
    // Reset detector state on every enable/disable transition
    frameBufferRef.current = [];
    isArmedRef.current = false;
    lastTriggerTimeRef.current = 0;
    setIsArmed(false);
    setLastLuminance(null);
    setBaselineLuminance(null);

    if (!enabled) return;

    const id = setInterval(async () => {
      if (!ref.current) return;

      let base64: string | undefined;
      try {
        const picture = await ref.current.takePictureAsync({ base64: true, quality: 0.1 });
        base64 = picture.base64;
      } catch {
        return;
      }

      if (!base64) return;

      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const lum = computeAverageLuminance(bytes);

      setLastLuminance(lum);

      const buffer = frameBufferRef.current;
      buffer.push(lum);
      if (buffer.length > BASELINE_SIZE) buffer.shift();

      // Still collecting baseline frames
      if (buffer.length < BASELINE_SIZE) return;

      const baseline = buffer.reduce((sum, v) => sum + v, 0) / buffer.length;
      setBaselineLuminance(baseline);

      // Arm on the frame that completes the baseline warm-up; skip detection
      if (!isArmedRef.current) {
        isArmedRef.current = true;
        setIsArmed(true);
        return;
      }

      const threshold = SENSITIVITY_THRESHOLDS[sensitivityRef.current];
      const now = Date.now();

      if (
        isMotionDetected(lum, baseline, threshold) &&
        now - lastTriggerTimeRef.current >= cooldownMsRef.current
      ) {
        lastTriggerTimeRef.current = now;
        onTriggerRef.current(now);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [enabled]);

  return { ref, isArmed, lastLuminance, baselineLuminance };
}
