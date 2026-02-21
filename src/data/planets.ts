import { OORT_CLOUD } from "./oortCloud";

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
  hasMission: boolean;
  companionGreeting: string;
  moons?: MoonConfig[];
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

export const PLANETS: PlanetConfig[] = [
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
  },
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
  if (planetId === "open-source") {
    return {
      id: OORT_CLOUD.id,
      label: OORT_CLOUD.label,
      subtitle: OORT_CLOUD.subtitle,
      color: OORT_CLOUD.color,
      emissive: OORT_CLOUD.emissive,
      radius: 0.3,
      orbitRadius: OORT_CLOUD.baseOrbitRadius,
      orbitSpeed: 0,
      orbitInclination: 0,
      orbitPhase: 5.5,
      hasRings: false,
      hasMission: false,
      companionGreeting: OORT_CLOUD.companionGreeting,
    } as PlanetConfig;
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
