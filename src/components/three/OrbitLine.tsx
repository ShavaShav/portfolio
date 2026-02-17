import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { Vector3 } from "three";

type OrbitLineProps = {
  radius: number;
  inclination: number;
};

export function OrbitLine({ radius, inclination }: OrbitLineProps) {
  const points = useMemo(() => {
    const result: Vector3[] = [];

    for (let index = 0; index <= 128; index += 1) {
      const angle = (index / 128) * Math.PI * 2;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const y = Math.sin(angle) * inclination * radius * 0.2;
      result.push(new Vector3(x, y, z));
    }

    return result;
  }, [inclination, radius]);

  return (
    <Line
      color="white"
      dashed
      dashSize={0.32}
      gapSize={0.18}
      opacity={0.25}
      points={points}
      transparent
    />
  );
}
