import { TERMINAL } from "./constants";

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Generate a random float between min and max */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Format coordinate for HUD display */
export function formatCoord(value: number, decimals = 2): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value).toFixed(decimals).padStart(decimals + 3, "0");
  return `${sign}${abs}`;
}

/** Generate random node data for terminal display */
export function generateNodeData(nodeId: string) {
  const { sectors, securityLevels, statuses } = TERMINAL.nodeData;

  const sector = sectors[Math.floor(Math.random() * sectors.length)];
  const security = securityLevels[Math.floor(Math.random() * securityLevels.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const uptime = `${Math.floor(randomRange(99.1, 99.99) * 100) / 100}%`;

  const packets = [
    `PKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    `ENC-${Math.floor(randomRange(1000, 9999))}`,
    `BLOB-${Math.floor(randomRange(100000, 999999))}`,
  ];
  const packet = packets[Math.floor(Math.random() * packets.length)];

  return {
    nodeId,
    sector,
    security,
    status,
    uptime,
    packet,
    timestamp: new Date().toISOString(),
  };
}

/** Typewriter effect: yields characters one at a time */
export async function* typeWriter(
  text: string,
  speed = TERMINAL.typingSpeed
): AsyncGenerator<string> {
  for (const char of text) {
    yield char;
    await new Promise((r) => setTimeout(r, speed));
  }
}

/** Debounce function */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Get random jitter offset */
export function getJitter(jitter: number): number {
  return (Math.random() - 0.5) * 2 * jitter;
}
