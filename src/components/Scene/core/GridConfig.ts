import { COLORS } from "@/lib/constants";

export const NEON = {
  cyan: [0, 0.96, 1] as [number, number, number],
  magenta: [1, 0, 0.43] as [number, number, number],
  amber: [1, 0.75, 0] as [number, number, number],
  green: [0.3, 1, 0.4] as [number, number, number],
  red: [1, 0.1, 0.1] as [number, number, number],
} as const;

export const CYBER_PALETTE = [
  NEON.cyan,
  NEON.cyan,
  NEON.cyan,
  NEON.amber,
  NEON.amber,
  NEON.green,
] as const;

export interface NodeConfig {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly gridZ: number;
  readonly basePosition: [number, number, number];
  readonly sector: string;
  readonly security: string;
  readonly status: string;
  readonly uptime: string;
  readonly packetId: string;
  readonly pulsePhase: number;
}

export interface ConnectionConfig {
  readonly id: string;
  readonly nodeA: string;
  readonly nodeB: string;
  readonly startPos: [number, number, number];
  readonly endPos: [number, number, number];
}

export interface PacketConfig {
  readonly id: string;
  readonly speed: number;
  readonly size: number;
  readonly color: [number, number, number];
  readonly corrupted: boolean;
  readonly burstGroup: number;
}

export const FX = {
  glitchDuration: 400,
  chromaticOffset: 3,
  noiseStrength: 0.02,
  packetSpeedMin: 1.5,
  packetSpeedMax: 4.5,
  packetSizeMin: 0.06,
  packetSizeMax: 0.14,
  corruptionRate: 0.15,
  maxPackets: 180,
  burstMinInterval: 8000,
  burstMaxInterval: 20000,
  burstMinCount: 5,
  burstMaxCount: 12,
  burstSpacingMs: 30,
  nodeRadius: 0.25,
  glowIntensity: 1.2,
  glowKernel: 32,
  lightRange: 8,
  lightIntensity: 0.3,
} as const;
