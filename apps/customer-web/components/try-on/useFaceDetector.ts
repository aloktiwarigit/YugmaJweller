'use client';
import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export interface UseFaceDetectorOptions {
  enabled: boolean;
}

export interface UseFaceDetectorResult {
  ready: boolean;
  detect: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult | null;
}

// Self-hosted paths — populated by scripts/copy-mediapipe-wasm.mjs and
// scripts/download-mediapipe-models.mjs before build.
const WASM_BASE_URL = '/mediapipe/wasm';
const FACE_MODEL_URL = '/mediapipe/face_landmarker.task';

export function useFaceDetector({ enabled }: UseFaceDetectorOptions): UseFaceDetectorResult {
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      if (cancelled) return;
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        refineLandmarks: true,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
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

  const detect = (video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null => {
    if (!detectorRef.current) return null;
    try {
      return detectorRef.current.detectForVideo(video, timestamp);
    } catch {
      return null;
    }
  };

  return { ready, detect };
}
