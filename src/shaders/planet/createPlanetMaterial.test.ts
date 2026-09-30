import { MeshStandardMaterial, ShaderMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { PLANETS } from "../../data/planets";
import { createPlanetMaterial } from "./createPlanetMaterial";

const planet = PLANETS.find((planet) => planet.id === "aws")!;
const config = {
  baseColor: planet.color,
  emissiveColor: planet.emissive,
  radius: planet.radius,
  visual: planet.visual,
};

describe("planet materials", () => {
  it("keeps animated surface, clouds and atmosphere in high quality", () => {
    const bundle = createPlanetMaterial(config, "high");
    expect(bundle.surfaceMaterial).toBeInstanceOf(ShaderMaterial);
    expect(bundle.cloudMaterial).toBeInstanceOf(ShaderMaterial);
    bundle.update(3);
    expect(
      (bundle.surfaceMaterial as ShaderMaterial).uniforms.uTime.value,
    ).toBe(3);
    expect(bundle.cloudMaterial?.uniforms.uTime.value).toBe(3);
    bundle.dispose();
  });
  it("reduces geometry and omits clouds on medium", () => {
    const bundle = createPlanetMaterial(config, "medium");
    expect(bundle.geometrySegments).toBe(40);
    expect(bundle.cloudMaterial).toBeNull();
    expect(bundle.atmosphereMaterial).not.toBeNull();
    bundle.dispose();
  });
  it("uses cheap lit materials without shells on low", () => {
    const bundle = createPlanetMaterial(config, "low");
    expect(bundle.surfaceMaterial).toBeInstanceOf(MeshStandardMaterial);
    expect(bundle.geometrySegments).toBe(24);
    expect(bundle.cloudMaterial).toBeNull();
    expect(bundle.atmosphereMaterial).toBeNull();
    bundle.setHover(true);
    expect(
      (bundle.surfaceMaterial as MeshStandardMaterial).emissiveIntensity,
    ).toBe(0.24);
    bundle.dispose();
  });
  it("disposes every GPU material when a bundle is replaced", () => {
    const bundle = createPlanetMaterial(config, "high");
    const disposals = [
      bundle.surfaceMaterial,
      bundle.cloudMaterial!,
      bundle.atmosphereMaterial!,
    ].map((material) => vi.spyOn(material, "dispose"));
    bundle.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});
