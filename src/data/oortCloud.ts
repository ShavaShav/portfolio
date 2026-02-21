export type AsteroidConfig = {
  id: string;
  label: string;
  description: string;
  url?: string;
  color: string;
  size: number;
};

export const OORT_CLOUD = {
  id: "open-source",
  label: "Oort Cloud",
  subtitle: "Side Projects & Open Source",
  baseOrbitRadius: 17,
  color: "#06b6d4",
  emissive: "#0891b2",
  companionGreeting:
    "My side projects and open source work. I love building tools that other developers use. Ask me about any of these!",
  asteroids: [
    {
      id: "express-openapi-zod",
      label: "express-openapi-zod",
      description: "OpenAPI schema generation from Zod for Express",
      url: "https://www.npmjs.com/package/express-openapi-zod",
      color: "#22d3ee",
      size: 0.12,
    },
    {
      id: "react-native-midi",
      label: "react-native-midi",
      description: "MIDI driver for React Native",
      url: "https://www.npmjs.com/package/react-native-midi",
      color: "#67e8f9",
      size: 0.1,
    },
    {
      id: "juzahach",
      label: "juzahach",
      description: "Vehicle tracker IoT project",
      url: "https://github.com/ShavaShav/juzahach",
      color: "#a5f3fc",
      size: 0.09,
    },
    {
      id: "react-native-soundfont",
      label: "react-native-soundfont",
      description: "Soundfont player for React Native",
      url: "https://www.npmjs.com/package/react-native-soundfont",
      color: "#cffafe",
      size: 0.08,
    },
    {
      id: "midio",
      label: "midio",
      description: "MIDI file player and sequencer",
      url: "https://github.com/ShavaShav/midio",
      color: "#ecfeff",
      size: 0.09,
    },
    {
      id: "indepocket",
      label: "indepocket",
      description: "Mobile app for tracking expenses",
      url: "https://github.com/ShavaShav/indepocket",
      color: "#06b6d4",
      size: 0.08,
    },
  ] as AsteroidConfig[],
};
