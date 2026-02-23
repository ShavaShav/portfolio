export type OortProjectConfig = {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  url?: string;
  color: string;
  emissive: string;
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitInclination: number;
  orbitPhase: number;
  companionGreeting: string;
  highlights: string[];
  tech: string[];
};

const OORT_RING_SPACING_SCALE = 1.12;

export const OORT_CLOUD = {
  label: "Oort Cloud",
  subtitle: "Outer Icy Ring",
  innerRadius: 19 * OORT_RING_SPACING_SCALE,
  outerRadius: 23 * OORT_RING_SPACING_SCALE,
  thickness: 1.2,
  color: "#86dfff",
  emissive: "#8fe6ff",
};

export const OORT_PROJECTS: OortProjectConfig[] = [
  {
    id: "express-openapi-zod",
    label: "express-openapi-zod",
    subtitle: "OpenAPI Tooling",
    description: "OpenAPI schema generation from Zod for Express",
    url: "https://www.npmjs.com/package/express-openapi-zod",
    color: "#9fe8ff",
    emissive: "#b4f0ff",
    size: 0.16,
    orbitRadius: 19.4 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.028,
    orbitInclination: 0.022,
    orbitPhase: 0.45,
    companionGreeting:
      "express-openapi-zod bridges validation and docs so Express APIs stay consistent without duplicated schema work.",
    highlights: [
      "Generates OpenAPI contracts directly from Zod models.",
      "Keeps API documentation aligned with runtime validation.",
      "Published as a reusable package for other teams and projects.",
    ],
    tech: ["TypeScript", "Express", "Zod", "OpenAPI"],
  },
  {
    id: "react-native-midi",
    label: "react-native-midi",
    subtitle: "Mobile Audio Systems",
    description: "MIDI driver for React Native",
    url: "https://www.npmjs.com/package/react-native-midi",
    color: "#9adfff",
    emissive: "#b9ebff",
    size: 0.14,
    orbitRadius: 20.1 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.026,
    orbitInclination: -0.019,
    orbitPhase: 1.34,
    companionGreeting:
      "react-native-midi gives mobile apps direct MIDI capabilities for instrument control and creative tooling.",
    highlights: [
      "Provides a React Native bridge for MIDI input and output.",
      "Supports music-oriented mobile workflows and prototyping.",
      "Designed for low-friction integration into production apps.",
    ],
    tech: ["TypeScript", "React Native", "MIDI", "Native Modules"],
  },
  {
    id: "juzahach",
    label: "juzahach",
    subtitle: "IoT Tracker",
    description: "Vehicle tracker IoT project",
    url: "https://github.com/ShavaShav/juzahach",
    color: "#bcf1ff",
    emissive: "#d8f8ff",
    size: 0.13,
    orbitRadius: 20.8 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.024,
    orbitInclination: 0.03,
    orbitPhase: 2.21,
    companionGreeting:
      "juzahach is an IoT tracker focused on turning raw telemetry into useful, reliable location context.",
    highlights: [
      "Tracks moving assets with connected device telemetry.",
      "Combines hardware signals with software orchestration.",
      "Explores practical reliability patterns for edge data flows.",
    ],
    tech: ["TypeScript", "Node.js", "IoT", "Telemetry"],
  },
  {
    id: "react-native-soundfont",
    label: "react-native-soundfont",
    subtitle: "Music Runtime",
    description: "Soundfont player for React Native",
    url: "https://www.npmjs.com/package/react-native-soundfont",
    color: "#d5f5ff",
    emissive: "#e9fbff",
    size: 0.12,
    orbitRadius: 21.5 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.023,
    orbitInclination: -0.017,
    orbitPhase: 3.08,
    companionGreeting:
      "react-native-soundfont brings sampled instrument playback to React Native, useful for music and audio-heavy apps.",
    highlights: [
      "Implements soundfont playback directly in mobile projects.",
      "Enables richer instrument rendering on React Native.",
      "Built to pair well with MIDI-oriented workflows.",
    ],
    tech: ["React Native", "Audio", "MIDI", "Native Modules"],
  },
  {
    id: "midio",
    label: "midio",
    subtitle: "Sequencing Engine",
    description: "MIDI file player and sequencer",
    url: "https://github.com/ShavaShav/midio",
    color: "#b7ebff",
    emissive: "#d1f4ff",
    size: 0.13,
    orbitRadius: 22.2 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.022,
    orbitInclination: 0.025,
    orbitPhase: 4.12,
    companionGreeting:
      "midio is a MIDI sequencing and playback project for experimenting with composition tooling and control flow.",
    highlights: [
      "Parses and plays MIDI files with controllable timing.",
      "Supports sequence manipulation and playback experiments.",
      "Useful as a foundation for music creation utilities.",
    ],
    tech: ["TypeScript", "MIDI", "Sequencing", "Audio"],
  },
  {
    id: "indepocket",
    label: "indepocket",
    subtitle: "Expense Tracker",
    description: "Mobile app for tracking expenses",
    url: "https://github.com/ShavaShav/indepocket",
    color: "#7fd9ff",
    emissive: "#a9e7ff",
    size: 0.14,
    orbitRadius: 22.9 * OORT_RING_SPACING_SCALE,
    orbitSpeed: 0.021,
    orbitInclination: -0.021,
    orbitPhase: 5.04,
    companionGreeting:
      "indepocket is a personal finance mobile app focused on simple expense tracking and everyday usability.",
    highlights: [
      "Tracks spending with lightweight mobile workflows.",
      "Explores clean UX for personal finance use cases.",
      "Built as a practical product-style side project.",
    ],
    tech: ["TypeScript", "React Native", "Mobile UX", "Data Modeling"],
  },
];
