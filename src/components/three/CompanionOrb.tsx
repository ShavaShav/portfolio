import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshBasicMaterial } from "three";
import { Vector3 } from "three";

type CompanionOrbProps = {
  active: boolean;
  isResponding: boolean;
};

const ORB_COLOR = "#88ccff";
const ORB_RADIUS = 0.08;
const _offset = new Vector3(-0.3, -0.2, -1);

export function CompanionOrb({ active, isResponding }: CompanionOrbProps) {
  const meshRef = useRef<Mesh>(null);
  const { camera } = useThree();
  const targetOpacity = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const elapsed = clock.getElapsedTime();

    // Fade in/out
    const goal = active ? 1 : 0;
    targetOpacity.current += (goal - targetOpacity.current) * 0.05;

    const material = meshRef.current.material as MeshBasicMaterial;
    material.opacity = targetOpacity.current * 0.6;

    if (targetOpacity.current < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    // Position relative to camera (lower-left of viewport)
    const worldOffset = _offset.clone().applyQuaternion(camera.quaternion);
    meshRef.current.position.copy(camera.position).add(worldOffset);

    // Pulse: gentle when idle, faster when responding
    const pulseSpeed = isResponding ? 6 : 2;
    const pulseScale = 1 + Math.sin(elapsed * pulseSpeed) * 0.15;
    meshRef.current.scale.setScalar(pulseScale);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[ORB_RADIUS, 16, 16]} />
      <meshBasicMaterial color={ORB_COLOR} opacity={0} transparent />
    </mesh>
  );
}
