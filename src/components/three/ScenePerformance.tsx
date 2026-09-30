import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export function ScenePerformance({
  onSample,
}: {
  onSample?: (fps: number) => void;
}) {
  const sample = useRef({ warmup: 0, elapsed: 0, frames: 0, skipNext: false });
  useEffect(() => {
    const reset = () => {
      sample.current.elapsed = 0;
      sample.current.frames = 0;
      sample.current.skipNext = true;
    };
    document.addEventListener("visibilitychange", reset);
    return () => document.removeEventListener("visibilitychange", reset);
  }, []);
  useFrame((_state, delta) => {
    const current = sample.current;
    if (document.hidden || current.skipNext) {
      current.skipNext = false;
      current.elapsed = 0;
      current.frames = 0;
      return;
    }
    // Exclude scene initialization and shader compilation from the first sample.
    if (current.warmup < 2) {
      current.warmup += delta;
      return;
    }
    current.elapsed += delta;
    current.frames += 1;
    if (current.elapsed >= 3) {
      onSample?.(current.frames / current.elapsed);
      current.elapsed = 0;
      current.frames = 0;
    }
  });
  return null;
}
