'use client';
import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';

export interface UseHandDetectorOptions {
  enabled: boolean;
}

export interface UseHandDetectorResult {
  ready: boolean;
  detect: (video: HTMLVideoElement, timestamp: number) => HandLandmarkerResult | null;
}

const WASM_BASE_URL = '/mediapipe/wasm';
const HAND_MODEL_URL = '/mediapipe/hand_landmarker.task';

export function useHandDetector({ enabled }: UseHandDetectorOptions): UseHandDetectorResult {
  const detectorRef = useRef<HandLandmarker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      if (cancelled) return;
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      if (cancelled) { landmarker.close(); return; }
      detectorRef.current = landmarker;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
      setReady(false);
    };
  }, [enabled]);

  const detect = (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
    if (!detectorRef.current) return null;
    try {
      return detectorRef.current.detectForVideo(video, timestamp);
    } catch {
      return null;
    }
  };

  return { ready, detect };
}
