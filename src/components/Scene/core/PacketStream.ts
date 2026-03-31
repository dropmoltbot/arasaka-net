"use client";

import {
  Scene as BabylonScene,
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  InstancedMesh,
  Mesh,
} from "@babylonjs/core";
import { ConnectionManager, ConnectionPath } from "./ConnectionManager";
import { NodeManager } from "./NodeManager";
import { randomRange } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface Packet {
  instance: InstancedMesh;
  material: StandardMaterial;
  startPos: Vector3;
  endPos: Vector3;
  progress: number;       // 0..1
  speed: number;          // units/sec
  baseSize: number;       // 0.06..0.14
  corrupted: boolean;
  color: Color3;
}

interface ArrivalAnim {
  packet: Packet;
  startTime: number;
  duration: number; // ms
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_PACKETS = 200;
const PACKET_COLORS = {
  cyan:    new Color3(0, 0.96, 1)    as unknown as Color3,
  amber:   new Color3(1, 0.75, 0)    as unknown as Color3,
  green:   new Color3(0.3, 1, 0.4)  as unknown as Color3,
  magenta: new Color3(1, 0, 0.43)    as unknown as Color3,
};

// ─── PACKET STREAM ────────────────────────────────────────────────────────────

export class PacketStream {
  private scene: BabylonScene;
  private connectionManager: ConnectionManager;
  private nodeManager: NodeManager;
  private pool: Packet[] = [];
  private arrivals: ArrivalAnim[] = [];
  private baseMesh: Mesh | null = null;

  // Timing
  private timeSinceSpawn = 0;
  private spawnInterval = 0.05; // seconds
  private burstTimer = 0;
  private burstInterval = 8 + Math.random() * 12; // 8-20s

  // ─── INIT ─────────────────────────────────────────────────────────────────

  constructor(
    scene: BabylonScene,
    connectionManager: ConnectionManager,
    nodeManager: NodeManager
  ) {
    this.scene = scene;
    this.connectionManager = connectionManager;
    this.nodeManager = nodeManager;
    this.initBaseMesh();
  }

  private initBaseMesh() {
    this.baseMesh = MeshBuilder.CreateSphere(
      "basePacket",
      { diameter: 1, segments: 4 },
      this.scene
    );
    this.baseMesh.isVisible = false;
  }

  // ─── SPAWN ────────────────────────────────────────────────────────────────

  spawnPacket(): boolean {
    if (this.pool.length >= MAX_PACKETS) return false;

    const conn = this.connectionManager.getRandomConnection();
    if (!conn) return false;

    const startPos = conn.startPos.clone();
    const endPos = conn.endPos.clone();

    // 15% corrupted
    const corrupted = Math.random() < 0.15;

    // Color distribution: cyan 60%, amber 25%, green 15%
    let color: Color3;
    if (corrupted) {
      color = PACKET_COLORS.magenta;
    } else {
      const r = Math.random();
      if (r < 0.6) color = PACKET_COLORS.cyan;
      else if (r < 0.85) color = PACKET_COLORS.amber;
      else color = PACKET_COLORS.green;
    }

    const speed = randomRange(1.5, 4.5);
    const baseSize = randomRange(0.06, 0.14);

    const mat = new StandardMaterial(`pm_${Date.now()}_${Math.random()}`, this.scene);
    mat.emissiveColor = color.clone() as unknown as Color3;
    mat.disableLighting = true;

    const instance = this.baseMesh!.createInstance(
      `packet_${Date.now()}_${Math.random()}`
    );
    instance.scaling = new Vector3(baseSize, baseSize, baseSize);
    instance.material = mat;
    instance.position = startPos.clone();

    const packet: Packet = {
      instance,
      material: mat,
      startPos,
      endPos,
      progress: 0,
      speed,
      baseSize,
      corrupted,
      color: color.clone() as unknown as Color3,
    };

    this.pool.push(packet);
    return true;
  }

  /** Burst event — 5-12 packets rapidly on a single line */
  burst() {
    const conn = this.connectionManager.getRandomConnection();
    if (!conn) return;

    const count = Math.floor(randomRange(5, 12));
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const startPos = conn.startPos.clone();
        const endPos = conn.endPos.clone();

        const corrupted = Math.random() < 0.15;
        let color: Color3;
        if (corrupted) {
          color = PACKET_COLORS.magenta;
        } else {
          const r = Math.random();
          if (r < 0.6) color = PACKET_COLORS.cyan;
          else if (r < 0.85) color = PACKET_COLORS.amber;
          else color = PACKET_COLORS.green;
        }

        const speed = randomRange(2.5, 6);
        const baseSize = randomRange(0.06, 0.14);

        const mat = new StandardMaterial(`pm_burst_${Date.now()}_${i}`, this.scene);
        mat.emissiveColor = color.clone() as unknown as Color3;
        mat.disableLighting = true;

        const instance = this.baseMesh!.createInstance(
          `packet_burst_${Date.now()}_${i}`
        );
        instance.scaling = new Vector3(baseSize, baseSize, baseSize);
        instance.material = mat;
        instance.position = startPos.clone();

        this.pool.push({
          instance,
          material: mat,
          startPos,
          endPos,
          progress: 0,
          speed,
          baseSize,
          corrupted,
          color: color.clone() as unknown as Color3,
        });
      }, i * 30);
    }
  }

  // ─── ARRIVAL FLASH ────────────────────────────────────────────────────────

  private triggerArrival(packet: Packet) {
    const duration = 80;
    this.arrivals.push({
      packet,
      startTime: performance.now(),
      duration,
    });
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  update(dt: number) {
    const now = performance.now();

    // Spawn timer
    this.timeSinceSpawn += dt;
    const interval = 0.04 + Math.random() * 0.06; // 40-100ms
    if (this.timeSinceSpawn >= interval) {
      this.spawnPacket();
      this.timeSinceSpawn = 0;
    }

    // Burst timer
    this.burstTimer += dt;
    if (this.burstTimer >= this.burstInterval) {
      this.burst();
      this.burstTimer = 0;
      this.burstInterval = 8 + Math.random() * 12;
    }

    // Process arrivals
    const doneArrivals: ArrivalAnim[] = [];
    for (const anim of this.arrivals) {
      const t = Math.min((now - anim.startTime) / anim.duration, 1);
      const packet = anim.packet;
      if (t >= 1) {
        // cleanup
        packet.instance.dispose();
        packet.material.dispose();
        doneArrivals.push(anim);
      } else {
        // scale up then fade
        const scale = packet.baseSize * (1 + 1.5 * Math.sin(t * Math.PI));
        packet.instance.scaling = new Vector3(scale, scale, scale);
        const cr = packet.color.r * (1 - t) + 1 * t;
        const cg = packet.color.g * (1 - t) + 1 * t;
        const cb = packet.color.b * (1 - t) + 1 * t;
        packet.material.emissiveColor = new Color3(cr, cg, cb) as unknown as Color3;
      }
    }
    this.arrivals = this.arrivals.filter((a) => !doneArrivals.includes(a));

    // Update active packets
    const toRemove: Packet[] = [];
    for (const packet of this.pool) {
      const pathLen = Vector3.Distance(packet.startPos, packet.endPos);
      const moveAmount = (packet.speed * dt) / pathLen;
      packet.progress = Math.min(packet.progress + moveAmount, 1);

      // Lerp position
      const pos = Vector3.Lerp(packet.startPos, packet.endPos, packet.progress);
      packet.instance.position = pos;

      // Sinusoidal jitter for corrupted
      if (packet.corrupted) {
        const wobble = Math.sin(now * 0.05) * 0.08;
        const wobbleY = Math.cos(now * 0.07) * 0.06;
        packet.instance.position.x += wobble;
        packet.instance.position.y += wobbleY;
      }

      // Scale pulse along journey
      const pulseFactor = 1 + 0.3 * Math.sin(packet.progress * Math.PI * 2);
      const s = packet.baseSize * pulseFactor;
      packet.instance.scaling = new Vector3(s, s, s);

      // Brightness: fade in (first 10%), fade out (last 20%)
      const fadeIn  = Math.min(packet.progress * 10, 1);           // 0→1 over 0..0.1
      const fadeOut = packet.progress > 0.8 ? (1 - packet.progress) / 0.2 : 1; // 1→0 over 0.8..1
      const brightness = fadeIn * fadeOut;

      const r = packet.color.r * brightness;
      const g = packet.color.g * brightness;
      const b = packet.color.b * brightness;
      packet.material.emissiveColor = new Color3(r, g, b) as unknown as Color3;

      // Arrival
      if (packet.progress >= 1) {
        this.triggerArrival(packet);
        toRemove.push(packet);
      }
    }

    for (const p of toRemove) {
      const idx = this.pool.indexOf(p);
      if (idx !== -1) this.pool.splice(idx, 1);
    }
  }

  // ─── PUBLIC ───────────────────────────────────────────────────────────────

  getPacketCount(): number {
    return this.pool.length + this.arrivals.length;
  }

  getPoolSize(): number { return this.pool.length; }
}
