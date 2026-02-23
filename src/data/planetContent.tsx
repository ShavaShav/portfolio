import type { ReactNode } from "react";
import { OORT_PROJECTS } from "./oortCloud";

type PlanetLink = {
  label: string;
  href: string;
};

export type PlanetContentEntry = {
  title: string;
  role: string;
  period: string;
  location?: string;
  summary: string;
  achievements: string[];
  tech: string[];
  links?: PlanetLink[];
  extra?: ReactNode;
};

const oortProjectEntries: Record<string, PlanetContentEntry> =
  Object.fromEntries(
    OORT_PROJECTS.map((project) => [
      project.id,
      {
        title: project.label.toUpperCase(),
        role: "Open Source Project",
        period: "Ongoing",
        summary: project.description,
        achievements: project.highlights,
        tech: project.tech,
        links: project.url
          ? [{ label: "Project Link", href: project.url }]
          : undefined,
      } as PlanetContentEntry,
    ]),
  );

export const PLANET_CONTENT: Record<string, PlanetContentEntry> = {
  obviant: {
    title: "OBVIANT",
    role: "Software Engineer",
    period: "2025 - Present",
    location: "Arlington, Virginia",
    summary:
      "Building critical systems at a military contracting startup. High ownership, fast iteration, and end-to-end product responsibility.",
    achievements: [
      "Driving full-stack delivery across frontend, backend, and infrastructure.",
      "Designing mission-ready workflows with strong reliability constraints.",
      "Building AI-assisted operator experiences for complex operational domains.",
    ],
    tech: ["TypeScript", "Python", "React", "Kubernetes", "PostgreSQL"],
  },
  aws: {
    title: "AMAZON WEB SERVICES",
    role: "Frontend Engineer",
    period: "Oct 2024 - 2025",
    location: "Arlington, Virginia",
    summary:
      "Built accessibility infrastructure and product tooling across AWS service teams.",
    achievements: [
      "Led audit of AWS Accessibility Evaluation Portal and fixed 30+ WCAG issues.",
      "Built deep-linking system with TypeScript-enforced query parameters.",
      "Optimized dashboard latency from seconds to under 200ms.",
      "Onboarded 40+ AWS services to automated accessibility testing.",
      "Developed report comparison tooling for regression detection.",
    ],
    tech: ["TypeScript", "React", "Next.js", "DynamoDB", "Python"],
  },
  riskfuel: {
    title: "RISKFUEL ANALYTICS",
    role: "Software Engineer",
    period: "Feb 2022 - Sep 2024",
    summary:
      "Built the platform that accelerated ML model delivery with strong operational reliability.",
    achievements: [
      "Designed end-to-end ML workflow platform using React, GraphQL, and CockroachDB.",
      "Reduced model time-to-release by 80%.",
      "Administered Kubernetes clusters for model execution workloads.",
      "Led frontend and backend architecture across multiple initiatives.",
      "Built monitoring stack with Prometheus and Grafana.",
    ],
    tech: [
      "TypeScript",
      "Python",
      "React",
      "Next.js",
      "GraphQL",
      "Kubernetes",
      "Docker",
    ],
  },
  "early-career": {
    title: "EARLY CAREER",
    role: "Timeline",
    period: "2016 - 2022",
    summary:
      "Foundational years across internships and early roles that shaped system-level engineering judgment.",
    achievements: [
      "2020-2022: T&T Power Group - full-stack IoT and ERP workflows.",
      "2019-2020: Eramosa Engineering - enterprise reporting and React Native tooling.",
      "2017-2018: GE Digital - BDD test automation with major quality gains.",
      "2018: Revision Military - robotic sensor fusion test platform.",
      "University of Windsor - CS TA, Honours B.CS, 4.0 GPA.",
    ],
    tech: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "C#"],
  },
  ...oortProjectEntries,
  about: {
    title: "ABOUT ME",
    role: "Human Behind The Code",
    period: "Always Active",
    location: "Arlington, VA",
    summary:
      "Canadian software engineer now based in the U.S., obsessed with building elegant systems and practical products.",
    achievements: [
      "Lives with Tony (dog) and Sylvie (cat).",
      "Interests: guitar, bass, sci-fi, chess, biking, and David Lynch films.",
      "Comfortable spanning UI/UX, backend systems, ML infrastructure, and deployment operations.",
    ],
    tech: ["TypeScript", "Python", "Distributed Systems", "Kubernetes", "AI"],
    links: [
      {
        label: "LinkedIn",
        href: "https://linkedin.com/in/zach-shaver",
      },
      {
        label: "GitHub",
        href: "https://github.com/ShavaShav",
      },
      {
        label: "Resume",
        href: "/resume.pdf",
      },
    ],
  },
};

export function getPlanetContent(planetId: string) {
  return PLANET_CONTENT[planetId];
}
