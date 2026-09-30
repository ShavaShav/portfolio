import { useMemo } from "react";
import { Color, DoubleSide } from "three";

const vertexShader = `
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vCenter;
  void main() {
    vPosition = position;
    vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fragmentShader = `
  uniform float uRadius;
  uniform vec3 uColor;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vCenter;
  void main() {
    float radius = length(vPosition.xy) / uRadius;
    // Attenuate high-frequency stripes when the rings occupy only a few pixels.
    float footprint = fwidth(radius);
    float bands = 0.55 + 0.2 * sin(radius * 90.0) * exp(-footprint * 90.0) + 0.12 * sin(radius * 210.0) * exp(-footprint * 210.0);
    float edge = smoothstep(1.45, 1.55, radius) * (1.0 - smoothstep(2.18, 2.35, radius));
    float gap = 1.0 - (smoothstep(1.91, 1.94, radius) * (1.0 - smoothstep(1.98, 2.01, radius)));
    vec3 lightDir = normalize(-vWorldPosition);
    vec3 toCenter = vCenter - vWorldPosition;
    float alongRay = dot(toCenter, lightDir);
    float rayDistance = length(toCenter - lightDir * alongRay);
    float shadow = alongRay > 0.0 ? smoothstep(uRadius * 0.95, uRadius * 1.08, rayDistance) : 1.0;
    vec3 color = mix(uColor * 0.48, uColor, bands) * (0.2 + shadow * 0.8);
    gl_FragColor = vec4(color, edge * gap * (0.2 + bands * 0.48));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function PlanetRings({
  radius,
  color,
}: {
  radius: number;
  color: string;
}) {
  const uniforms = useMemo(
    () => ({ uRadius: { value: radius }, uColor: { value: new Color(color) } }),
    [radius, color],
  );
  return (
    <mesh rotation={[-Math.PI / 2.8, 0.35, 0]}>
      <ringGeometry args={[radius * 1.45, radius * 2.35, 128]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
