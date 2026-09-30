import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, BackSide, ShaderMaterial } from "three";
import type { Mesh } from "three";
import {
  sunCoronaFragmentShader,
  sunFragmentShader,
  sunVertexShader,
} from "../../shaders/sun";
import { RENDER_QUALITY } from "../../data/renderQuality";
import type { QualityTier } from "../../hooks/useDeviceCapability";

type SunProps = {
  onSelect?: () => void;
  isMobile?: boolean;
  qualityTier?: QualityTier;
  showLabel?: boolean;
};

export function Sun({
  onSelect,
  isMobile = false,
  qualityTier = "high",
  showLabel = true,
}: SunProps) {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  const shaderMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sunVertexShader,
        fragmentShader: sunFragmentShader,
        defines: qualityTier === "low" ? { LOW_QUALITY: 1 } : {},
        uniforms: {
          uTime: { value: 0 },
        },
      }),
    [qualityTier],
  );
  const coronaMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sunVertexShader,
        fragmentShader: sunCoronaFragmentShader,
        uniforms: { uTime: { value: 0 }, uHoverBoost: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: BackSide,
        blending: AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);
  useEffect(() => () => coronaMaterial.dispose(), [coronaMaterial]);

  useEffect(() => {
    document.body.style.cursor = isHovered ? "pointer" : "default";

    return () => {
      document.body.style.cursor = "default";
    };
  }, [isHovered]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const pulse = 1 + Math.sin(elapsed * 0.5) * 0.02;

    // Update shader time uniform
    shaderMaterial.uniforms.uTime.value = elapsed;
    coronaMaterial.uniforms.uTime.value = elapsed;
    coronaMaterial.uniforms.uHoverBoost.value = isHovered ? 1 : 0;

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.05;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(elapsed * 0.7) * 0.008);
    }
  });

  return (
    <group>
      <mesh
        material={shaderMaterial}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        ref={coreRef}
      >
        <sphereGeometry
          args={[
            1.5,
            RENDER_QUALITY[qualityTier].sphereSegments,
            RENDER_QUALITY[qualityTier].sphereSegments,
          ]}
        />
      </mesh>

      {/* Larger invisible touch target for mobile */}
      {isMobile ? (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
          visible={false}
        >
          <sphereGeometry args={[3.5, 16, 16]} />
          <meshBasicMaterial />
        </mesh>
      ) : null}

      {/* Corona glow layer */}
      <mesh ref={glowRef} material={coronaMaterial}>
        <sphereGeometry args={[1.67, 32, 24]} />
      </mesh>

      {showLabel ? (
        <Html
          center
          distanceFactor={10}
          position={[0, 2.2, 0]}
          zIndexRange={[2, 0]}
        >
          <div
            className={`planet-label ${isHovered ? "planet-label--active" : ""}`}
            style={{ pointerEvents: "none" }}
          >
            <strong>About Me</strong>
            <span>Zach Shaver</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
