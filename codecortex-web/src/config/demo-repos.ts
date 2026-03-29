/**
 * Pre-loaded demo repositories for instant "wow" onboarding.
 * These are curated, small-to-medium repos that index quickly
 * and show interesting architectural patterns.
 */
export interface DemoRepo {
  name: string;
  description: string;
  url: string;
  language: string;
  icon: string;     // Emoji icon
  size: string;     // Human-readable approx size
  features: string; // What makes this demo interesting
}

export const DEMO_REPOS: DemoRepo[] = [
  {
    name: 'Express.js',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    url: 'https://github.com/expressjs/express',
    language: 'JavaScript',
    icon: '🚂',
    size: '~200 files',
    features: 'Clean middleware architecture, community structure',
  },
  {
    name: 'Zustand',
    description: 'Bear necessities for state management in React',
    url: 'https://github.com/pmndrs/zustand',
    language: 'TypeScript',
    icon: '🐻',
    size: '~50 files',
    features: 'Compact architecture, clear call graph',
  },
  {
    name: 'Hono',
    description: 'Ultrafast web framework for the Edges',
    url: 'https://github.com/honojs/hono',
    language: 'TypeScript',
    icon: '🔥',
    size: '~300 files',
    features: 'Multi-runtime adapters, rich dependency graph',
  },
  {
    name: 'tRPC',
    description: 'End-to-end typesafe APIs made easy',
    url: 'https://github.com/trpc/trpc',
    language: 'TypeScript',
    icon: '🔗',
    size: '~250 files',
    features: 'Complex monorepo, cross-package dependencies',
  },
  {
    name: 'Fastify',
    description: 'Fast and low overhead web framework for Node.js',
    url: 'https://github.com/fastify/fastify',
    language: 'JavaScript',
    icon: '⚡',
    size: '~150 files',
    features: 'Plugin architecture, lifecycle hooks',
  },
];
