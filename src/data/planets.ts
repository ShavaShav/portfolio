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
    companionGreeting:
      "My early career - internships and first full-time roles. This is where I learned the fundamentals. The mission here covers a zero-downtime database migration I pulled off at T&T Power Group.",
  },
  {
    id: "open-source",
    label: "Open Source",
    subtitle: "npm packages and side projects",
    color: "#06b6d4",
    emissive: "#0891b2",
    radius: 0.45,
    orbitRadius: 17,
    orbitSpeed: 0.03,
    orbitInclination: -0.1,
    orbitPhase: 5.5,
    hasRings: false,
    hasMission: false,
    companionGreeting:
      "My side projects and open source work. I love building tools that other developers use. Ask me about any of these!",
  },
  {
    id: "about",
    label: "About Me",
    subtitle: "Human behind the code",
    color: "#3b82f6",
    emissive: "#2563eb",
    radius: 0.5,
    orbitRadius: 20,
    orbitSpeed: 0.02,
    orbitInclination: 0.15,
    orbitPhase: 3,
    hasRings: false,
    hasMission: false,
    companionGreeting:
      "This is the personal stuff - where I'm from, what I'm into, what makes me tick beyond code. Feel free to ask me anything.",
  },
];

export function getPlanetById(planetId: string) {
  return PLANETS.find((planet) => planet.id === planetId);
}
