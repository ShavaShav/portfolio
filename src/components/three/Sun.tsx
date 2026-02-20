import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShaderMaterial } from "three";
import type { Mesh } from "three";
import { sunFragmentShader, sunVertexShader } from "../../shaders/sun";

type SunProps = {
  onSelect?: () => void;
};

export function Sun({ onSelect }: SunProps) {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  const shaderMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: sunVertexShader,
        fragmentShader: sunFragmentShader,
        uniforms: {
          uTime: { value: 0 },
        },
      }),
    [],
  );

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

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.05;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.3 + Math.sin(elapsed * 0.7) * 0.03);
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
        <sphereGeometry args={[1.5, 64, 64]} />
      </mesh>

      {/* Corona glow layer */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.95, 32, 32]} />
        <meshBasicMaterial
          color={isHovered ? "#ffcc66" : "#ffbb55"}
          opacity={isHovered ? 0.25 : 0.18}
          transparent
        />
      </mesh>

      <Html center distanceFactor={10} position={[0, 2.2, 0]}>
        <div
          className={`planet-label ${isHovered ? "planet-label--active" : ""}`}
        >
          <strong>About Me</strong>
          <span>Zach Shaver</span>
        </div>
      </Html>
    </group>
  );
}
