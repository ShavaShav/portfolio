import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  RepeatWrapping,
  SRGBColorSpace,
  type Mesh,
} from "three";
import type { MoonConfig } from "../../data/planets";

type MoonProps = {
  moon: MoonConfig;
  onSelect?: (moonId: string) => void;
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function createMoonTexture(moon: MoonConfig) {
  if (typeof document === "undefined") return null;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const base = new Color(moon.color);
  const seed = hashString(moon.id);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const unitA = seededUnit(seed + x * 0.17 + y * 0.31);
      const unitB = seededUnit(seed * 0.73 + x * 0.08 - y * 0.23);
      const grain = 0.72 + unitA * 0.5;
      const banding = 0.85 + unitB * 0.35;
      const shade = grain * banding;

      const r = Math.min(255, Math.max(0, Math.floor(base.r * 255 * shade)));
      const g = Math.min(255, Math.max(0, Math.floor(base.g * 255 * shade)));
      const b = Math.min(255, Math.max(0, Math.floor(base.b * 255 * shade)));
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const craterCount = 24;
  for (let i = 0; i < craterCount; i += 1) {
    const cSeed = seed + i * 13.37;
    const cx = seededUnit(cSeed * 0.73 + 1.2) * size;
    const cy = seededUnit(cSeed * 1.11 + 2.9) * size;
    const radius = 3 + seededUnit(cSeed * 1.91 + 6.1) * 10;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12, 18, 22, 0.23)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - radius * 0.22, cy - radius * 0.22, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(218, 246, 255, 0.08)";
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.6, 1.6);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function Moon({ moon, onSelect }: MoonProps) {
  const meshRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const isEarlyCareerMoon = moon.id.startsWith("early-career-");
  const texture = useMemo(
    () => (isEarlyCareerMoon ? createMoonTexture(moon) : null),
    [isEarlyCareerMoon, moon],
  );

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;

    const elapsed = clock.getElapsedTime();
    const angle = elapsed * moon.orbitSpeed + moon.orbitPhase;

    meshRef.current.position.set(
      moon.orbitRadius * Math.cos(angle),
      moon.orbitRadius * 0.1 * Math.sin(angle * 0.7),
      moon.orbitRadius * Math.sin(angle),
    );

    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(moon.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setIsHovered(false);
        document.body.style.cursor = "default";
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
    >
      <sphereGeometry
        args={[moon.radius, isEarlyCareerMoon ? 24 : 16, isEarlyCareerMoon ? 24 : 16]}
      />
      <meshStandardMaterial
        color={moon.color}
        displacementMap={texture ?? undefined}
        displacementScale={isEarlyCareerMoon ? moon.radius * 0.12 : 0}
        emissive={moon.color}
        emissiveIntensity={isHovered ? 1.0 : isEarlyCareerMoon ? 0.42 : 0.3}
        map={texture ?? undefined}
        metalness={isEarlyCareerMoon ? 0.08 : 0}
        roughness={isEarlyCareerMoon ? 0.86 : 0.7}
      />
      {isHovered || isEarlyCareerMoon ? (
        <Html center distanceFactor={8} position={[0, moon.radius + 0.2, 0]}>
          <div
            className={`planet-label ${isHovered || isEarlyCareerMoon ? "planet-label--active" : ""}`}
          >
            <strong>{moon.label}</strong>
            {isHovered ? <span>{moon.subtitle}</span> : null}
          </div>
        </Html>
      ) : null}
    </mesh>
  );
}
