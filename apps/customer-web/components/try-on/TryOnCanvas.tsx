'use client';
import React, { useEffect, useRef } from 'react';
import type { CatalogTryOnResponse } from '@goldsmith/customer-shared';
import { useFaceDetector } from './useFaceDetector';
import { useHandDetector } from './useHandDetector';
import { renderFaceOverlay, makeFaceSmooths, type FaceSmooths } from './face-renderer';
import { renderHandOverlay, makeHandSmooths, type HandSmooths } from './hand-renderer';

interface TryOnCanvasProps {
  stream: MediaStream;
  tryOnData: CatalogTryOnResponse;
  onDetectorReady: () => void;
}

export function TryOnCanvas({ stream, tryOnData, onDetectorReady }: TryOnCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const faceSmooths = useRef<FaceSmooths>(makeFaceSmooths());
  const handSmooths = useRef<HandSmooths>(makeHandSmooths());

  const isFace = tryOnData.bodyPart === 'EAR' || tryOnData.bodyPart === 'NECK';
  const isHand = tryOnData.bodyPart === 'FINGER' || tryOnData.bodyPart === 'WRIST';

  const { ready: faceReady, detect: detectFace } = useFaceDetector({ enabled: isFace });
  const { ready: handReady, detect: detectHand } = useHandDetector({ enabled: isHand });

  const detectorReady = isFace ? faceReady : handReady;

  // Connect the camera stream to the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play();
  }, [stream]);

  // Load the transparent-PNG cutout asset
  useEffect(() => {
    if (!tryOnData.assetUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { assetImgRef.current = img; };
    img.src = tryOnData.assetUrl;
  }, [tryOnData.assetUrl]);

  // Notify parent when detector is ready (triggers loading → active transition)
  useEffect(() => {
    if (detectorReady) onDetectorReady();
  }, [detectorReady, onDetectorReady]);

  // requestAnimationFrame loop — runs only after the detector is ready
  useEffect(() => {
    if (!detectorReady) return;
    let running = true;

    function loop(timestamp: number) {
      if (!running) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (video && canvas && ctx && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const assetImg = assetImgRef.current;

        if (assetImg) {
          if (isFace) {
            const result = detectFace(video, timestamp);
            if (result && result.faceLandmarks.length > 0) {
              renderFaceOverlay({
                ctx, canvas, result, tryOnData,
                assetImg, smooths: faceSmooths.current, timestamp,
              });
            }
          } else if (isHand) {
            const result = detectHand(video, timestamp);
            if (result && result.landmarks.length > 0) {
              renderHandOverlay({
                ctx, canvas, result, tryOnData,
                assetImg, smooths: handSmooths.current, timestamp,
              });
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [detectorReady, isFace, isHand, tryOnData, detectFace, detectHand]);

  return (
    // scaleX(-1): mirror the whole view so it feels like a selfie camera.
    // MediaPipe processes the raw (unmirrored) feed; renderers flip x via mirrorXIfNeeded.
    <div className="relative w-full h-full" style={{ transform: 'scaleX(-1)' }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
