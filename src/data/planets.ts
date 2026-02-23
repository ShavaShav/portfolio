import { OORT_PROJECTS } from "./oortCloud";

export type PlanetSurfaceType = "rocky" | "gas" | "crystalline" | "terran";

export type PlanetCloudVisualConfig = {
  enabled: boolean;
  color: string;
  opacity: number;
  speed: number;
  noiseScale: number;
};

export type PlanetVisualConfig = {
  palette: [string, string, string];
  oceanColor?: string;
  landThreshold?: number;
  atmosphereColor: string;
  atmosphereIntensity: number;
  noiseScale: number;
  detailScale: number;
  banding: number;
  displacementScale: number;
  emissiveDetailColor: string;
  emissiveDetailStrength: number;
  seed: number;
  surfaceType: PlanetSurfaceType;
  clouds?: PlanetCloudVisualConfig;
};

export type PlanetConfig = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  emissive: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitInclination: number;
  orbitPhase: number;
  hasRings?: boolean;
  ringColor?: string;
  showOrbitLine?: boolean;
  hasMission: boolean;
  companionGreeting: string;
  moons?: MoonConfig[];
  visual?: PlanetVisualConfig;
};

export type MoonConfig = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
};

const CORE_PLANETS: PlanetConfig[] = [
  {
    id: "obviant",
    label: "Obviant",
    subtitle: "Software Engineer",
    color: "#dc2626",
    emissive: "#991b1b",
    radius: 0.6,
    orbitRadius: 5,
    orbitSpeed: 0.15,
    orbitInclination: 0.1,
    orbitPhase: 0,
    hasRings: true,
    ringColor: "#f87171",
    hasMission: true,
    companionGreeting:
      "Welcome to Obviant - this is where I'm working now. A small military contracting startup where I wear a lot of hats. Want to see what I've been building, or jump into a mission?",
    visual: {
      palette: ["#541209", "#b63c1d", "#f3772f"],
      atmosphereColor: "#ff8f55",
      atmosphereIntensity: 0.56,
      noiseScale: 3.9,
      detailScale: 9.6,
      banding: 1.25,
      displacementScale: 0.016,
      emissiveDetailColor: "#ff7b3c",
      emissiveDetailStrength: 0.24,
      seed: 11.7,
      surfaceType: "rocky",
    },
  },
  {
    id: "aws",
    label: "AWS",
    subtitle: "Frontend Engineer",
    color: "#ff9900",
    emissive: "#cc7700",
    radius: 0.55,
    orbitRadius: 8,
    orbitSpeed: 0.1,
    orbitInclination: -0.15,
    orbitPhase: 2.5,
    hasRings: true,
    ringColor: "#ffd48a",
    hasMission: true,
    companionGreeting:
      "Amazon Web Services - I built accessibility infrastructure here that touched 40+ AWS services. The mission on this planet is about a performance problem I solved. Curious?",
    visual: {
      palette: ["#5f3609", "#d9851f", "#ffe2a0"],
      atmosphereColor: "#ffd28a",
      atmosphereIntensity: 0.86,
      noiseScale: 2.55,
      detailScale: 5.8,
      banding: 3.2,
      displacementScale: 0,
      emissiveDetailColor: "#fff1c3",
      emissiveDetailStrength: 0.12,
      seed: 24.3,
      surfaceType: "gas",
      clouds: {
        enabled: true,
        color: "#ffe8b9",
        opacity: 0.42,
        speed: 0.2,
        noiseScale: 3.45,
      },
    },
  },
  {
    id: "riskfuel",
    label: "Riskfuel",
    subtitle: "Software Engineer",
    color: "#7c3aed",
    emissive: "#5b21b6",
    radius: 0.5,
    orbitRadius: 11,
    orbitSpeed: 0.07,
    orbitInclination: 0.05,
    orbitPhase: 4.2,
    hasRings: false,
    hasMission: true,
    companionGreeting:
      "Riskfuel Analytics - this is where I got deep into distributed systems and Kubernetes. I built a platform that made ML models ship 80% faster. The mission here is about scaling that to 1000+ workloads.",
    visual: {
      palette: ["#26174f", "#6033cd", "#a071ff"],
      atmosphereColor: "#cb9fff",
      atmosphereIntensity: 0.74,
      noiseScale: 4.35,
      detailScale: 12.4,
      banding: 2.05,
      displacementScale: 0.014,
      emissiveDetailColor: "#8ce7ff",
      emissiveDetailStrength: 0.24,
      seed: 38.8,
      surfaceType: "rocky",
    },
  },
  {
    id: "early-career",
    label: "Early Career",
    subtitle: "T&T / Eramosa / GE / Revision",
    color: "#10b981",
    emissive: "#059669",
    radius: 0.4,
    orbitRadius: 14,
    orbitSpeed: 0.05,
    orbitInclination: 0.2,
    orbitPhase: 1,
    hasRings: false,
    hasMission: true,
    moons: [
      {
        id: "early-career-tnt",
        label: "T&T Power",
        subtitle: "Full-Stack IoT & ERP",
        color: "#34d399",
        radius: 0.12,
        orbitRadius: 1.2,
        orbitSpeed: 0.4,
        orbitPhase: 0,
      },
      {
        id: "early-career-eramosa",
        label: "Eramosa",
        subtitle: "Enterprise Reporting",
        color: "#6ee7b7",
        radius: 0.1,
        orbitRadius: 1.6,
        orbitSpeed: 0.3,
        orbitPhase: Math.PI / 2,
      },
      {
        id: "early-career-ge",
        label: "GE Digital",
        subtitle: "Test Automation",
        color: "#a7f3d0",
        radius: 0.11,
        orbitRadius: 1.9,
        orbitSpeed: 0.25,
        orbitPhase: Math.PI,
      },
      {
        id: "early-career-revision",
        label: "Revision Military",
        subtitle: "Sensor Fusion",
        color: "#d1fae5",
        radius: 0.1,
        orbitRadius: 2.2,
        orbitSpeed: 0.2,
        orbitPhase: (3 * Math.PI) / 2,
      },
    ],
    companionGreeting:
      "My early career - internships and first full-time roles. This is where I learned the fundamentals. The mission here covers a zero-downtime database migration I pulled off at T&T Power Group.",
    visual: {
      palette: ["#3d8c3f", "#5dbb57", "#9fdc8f"],
      oceanColor: "#1f63aa",
      landThreshold: 0.47,
      atmosphereColor: "#8efde0",
      atmosphereIntensity: 0.92,
      noiseScale: 3.15,
      detailScale: 8.7,
      banding: 1.55,
      displacementScale: 0.006,
      emissiveDetailColor: "#80ebff",
      emissiveDetailStrength: 0.1,
      seed: 47.1,
      surfaceType: "terran",
      clouds: {
        enabled: true,
        color: "#defef4",
        opacity: 0.36,
        speed: 0.24,
        noiseScale: 4.05,
      },
    },
  },
];

const OORT_PROJECT_VISUALS: PlanetVisualConfig[] = [
  {
    palette: ["#19313d", "#3b6c80", "#9fe8ff"],
    atmosphereColor: "#bcefff",
    atmosphereIntensity: 0.45,
    noiseScale: 5.8,
    detailScale: 13.2,
    banding: 1.15,
    displacementScale: 0.02,
    emissiveDetailColor: "#d7f8ff",
    emissiveDetailStrength: 0.17,
    seed: 62.1,
    surfaceType: "crystalline",
  },
  {
    palette: ["#1f3746", "#476f86", "#b8ecff"],
    atmosphereColor: "#c9f1ff",
    atmosphereIntensity: 0.4,
    noiseScale: 5.2,
    detailScale: 11.8,
    banding: 0.9,
    displacementScale: 0.018,
    emissiveDetailColor: "#dbf7ff",
    emissiveDetailStrength: 0.14,
    seed: 68.4,
    surfaceType: "crystalline",
  },
  {
    palette: ["#182c39", "#3f6379", "#c5f2ff"],
    atmosphereColor: "#c9f4ff",
    atmosphereIntensity: 0.42,
    noiseScale: 6.1,
    detailScale: 12.6,
    banding: 1.05,
    displacementScale: 0.019,
    emissiveDetailColor: "#e2fbff",
    emissiveDetailStrength: 0.15,
    seed: 74.9,
    surfaceType: "crystalline",
  },
];

export const OORT_PROJECT_PLANETS: PlanetConfig[] = OORT_PROJECTS.map(
  (project, index) => ({
    id: project.id,
    label: project.label,
    subtitle: project.subtitle,
    color: project.color,
    emissive: project.emissive,
    radius: project.size,
    orbitRadius: project.orbitRadius,
    orbitSpeed: project.orbitSpeed,
    orbitInclination: project.orbitInclination,
    orbitPhase: project.orbitPhase,
    hasRings: false,
    showOrbitLine: false,
    hasMission: false,
    companionGreeting: project.companionGreeting,
    visual: {
      ...OORT_PROJECT_VISUALS[index % OORT_PROJECT_VISUALS.length],
      seed:
        OORT_PROJECT_VISUALS[index % OORT_PROJECT_VISUALS.length].seed + index,
    },
  }),
);

export const PLANETS: PlanetConfig[] = [
  ...CORE_PLANETS,
  ...OORT_PROJECT_PLANETS,
];

export const SUN_AS_ABOUT: PlanetConfig = {
  id: "about",
  label: "About Me",
  subtitle: "Zach Shaver",
  color: "#ff9900",
  emissive: "#ff5500",
  radius: 1.5,
  orbitRadius: 0,
  orbitSpeed: 0,
  orbitInclination: 0,
  orbitPhase: 0,
  hasRings: false,
  hasMission: false,
  companionGreeting:
    "This is the personal stuff - where I'm from, what I'm into, what makes me tick beyond code. Feel free to ask me anything.",
};

export function getPlanetById(planetId: string) {
  if (planetId === "about") {
    return SUN_AS_ABOUT;
  }
  return PLANETS.find((planet) => planet.id === planetId);
}

export function getPlanetPositionAtTime(
  planet: PlanetConfig,
  elapsedTime: number,
) {
  const angle = elapsedTime * planet.orbitSpeed + planet.orbitPhase;

  return {
    x: planet.orbitRadius * Math.cos(angle),
    y: Math.sin(angle) * planet.orbitInclination * planet.orbitRadius * 0.2,
    z: planet.orbitRadius * Math.sin(angle),
  };
}
