export const COLORS = {
  bgPrimary: "#050508",
  bgSecondary: "#0a0a0f",
  neonCyan: "#00f5ff",
  neonMagenta: "#ff006e",
  neonAmber: "#ffbe0b",
  gridLine: "#1a1a2e",
  textPrimary: "#e0e0e0",
  textMuted: "#4a4a5a",
} as const;

export const GRID = {
  /** Number of nodes along each axis */
  nodeCountX: 12,
  nodeCountY: 8,
  /** Spacing between nodes in world units */
  spacing: 8,
  /** Jitter applied to node positions (±units) */
  jitter: 0.5,
  /** Z depth of the grid (negative = into screen) */
  depth: -200,
  /** Node sphere radius */
  nodeRadius: 0.25,
  /** Max simultaneous active nodes */
  maxActive: 200,
} as const;

export const SCENE = {
  /** Camera dolly speed multiplier */
  scrollSensitivity: 0.15,
  /** Camera lerp factor for smooth movement */
  cameraLerp: 0.08,
  /** Max scroll speed cap */
  maxScrollSpeed: 2.5,
  /** GlowLayer intensity */
  glowIntensity: 1.2,
  glowKernel: 32,
  /** PointLight range and intensity per node */
  lightRange: 8,
  lightIntensity: 0.3,
  /** Node pulse interval (ms) */
  pulseInterval: 4000,
} as const;

export const SHADER = {
  glitchDuration: 400,
  chromaticOffset: 3,
  noiseStrength: 0.02,
} as const;

export const TERMINAL = {
  typingSpeed: 30,
  nodeData: {
    sectors: ["ALPHA", "BETA", "GAMMA", "DELTA", "OMEGA"],
    securityLevels: ["LEVEL 0", "LEVEL 1", "LEVEL 2", "LEVEL 3", "RESTRICTED"],
    statuses: [
      "NOMINAL",
      "MONITORED",
      "COMPROMISED",
      "OFFLINE",
      "ENCRYPTED",
    ],
  },
} as const;
