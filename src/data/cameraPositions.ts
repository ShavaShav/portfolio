export const CAMERA_DEFAULT = {
  position: [0, 8, 24] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  fov: 60,
};

export const CAMERA_ENTRANCE = {
  position: [0, 50, 150] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
};

export function getOverviewCameraPosition(
  aspect: number,
): [number, number, number] {
  // Fit the main planetary orbits horizontally in a portrait viewport.
  const multiplier = aspect < 1 ? 1.2 / Math.max(aspect, 0.25) : 1;
  return CAMERA_DEFAULT.position.map((value) => value * multiplier) as [
    number,
    number,
    number,
  ];
}
