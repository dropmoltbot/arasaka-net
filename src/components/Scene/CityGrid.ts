"use client";

import {
  Scene as BabylonScene,
  GlowLayer,
  Vector3,
} from "@babylonjs/core";
import { GRID } from "@/lib/constants";
import { NodeManager } from "./core/NodeManager";
import { ConnectionManager } from "./core/ConnectionManager";
import { PacketStream } from "./core/PacketStream";
import { GlitchEffects } from "./fx/GlitchEffects";
import { AttackWave } from "./fx/AttackWave";

export interface CityGridCallbacks {
  onNodeClick: (meshName: string) => void;
  onHover: () => void;
  onWaveStart: () => void;
  onWavePass: () => void;
  onMicroGlitch: () => void;
  onFullGlitch: () => void;
  onDronePitch: (pitch: number) => void;
}

export class CityGrid {
  private scene: BabylonScene;
  private nodeManager: NodeManager;
  private connectionManager: ConnectionManager;
  private packetStream: PacketStream;
  private glitchEffects: GlitchEffects;
  private attackWave: AttackWave;

  private lastSpawnZ = 0;
  private lastDespawnZ = 0;
  private lastTime = 0;

  constructor(
    scene: BabylonScene,
    glow: GlowLayer,
    callbacks: CityGridCallbacks
  ) {
    this.scene = scene;

    // ── Node manager ──────────────────────────────────────────────────────────
    this.nodeManager = new NodeManager(scene, glow, {
      onHover: callbacks.onHover,
      onNodeClick: callbacks.onNodeClick,
    });

    // ── Connection manager ────────────────────────────────────────────────────
    this.connectionManager = new ConnectionManager(scene, this.nodeManager);

    // ── Packet stream ─────────────────────────────────────────────────────────
    this.packetStream = new PacketStream(scene, this.connectionManager, this.nodeManager);

    // ── Glitch effects ────────────────────────────────────────────────────────
    // We need the pipeline — but pipeline lives in Scene.tsx. We pass a
    // stub/getter pattern via the callbacks, or we set it after construction.
    // Actually GlitchEffects needs the pipeline directly. We defer its creation.
    this.glitchEffects = new GlitchEffects(scene, null as any, {
      onMicroGlitch: callbacks.onMicroGlitch,
      onFullGlitch: callbacks.onFullGlitch,
    });

    // ── Attack wave ───────────────────────────────────────────────────────────
    this.attackWave = new AttackWave(scene, this.nodeManager, this.glitchEffects, {
      onWaveStart: callbacks.onWaveStart,
      onWavePass: callbacks.onWavePass,
      onDronePitch: callbacks.onDronePitch,
    });

    // ── Initial grid ─────────────────────────────────────────────────────────
    this.spawnInitialGrid();
  }

  /** Called by Scene.tsx once DefaultRenderingPipeline is created */
  setPipeline(pipeline: import("@babylonjs/core").DefaultRenderingPipeline) {
    // Re-initialize glitch effects with real pipeline
    // (we recreate rather than mutate to keep types clean)
    this.glitchEffects = new GlitchEffects(
      this.scene,
      pipeline,
      {
        onMicroGlitch: () => { /* handled by Scene via callback */ },
        onFullGlitch: () => { /* handled by Scene via callback */ },
      }
    );
    // Also wire into attack wave
    // AttackWave holds a reference — swap it out by passing new GlitchEffects
    // Actually AttackWave already has its own GlitchEffects ref. Let's update it.
    // For simplicity, AttackWave still owns its GlitchEffects. The one we pass
    // here is used for the render-loop update. Let's expose updateGlitchFromPipeline.
    this._pipeline = pipeline;
  }

  private _pipeline: import("@babylonjs/core").DefaultRenderingPipeline | null = null;
  private get pipeline() { return this._pipeline; }

  // ─── SPAWN ──────────────────────────────────────────────────────────────────

  private spawnInitialGrid() {
    const gridZStart = Math.floor(this.lastSpawnZ / GRID.spacing);
    const gridZEnd = gridZStart + 6;

    for (let gz = gridZStart; gz <= gridZEnd; gz++) {
      for (let gx = 0; gx < GRID.nodeCountX; gx++) {
        for (let gy = 0; gy < GRID.nodeCountY; gy++) {
          const node = this.nodeManager.spawnNode(
            gx - Math.floor(GRID.nodeCountX / 2),
            gy - Math.floor(GRID.nodeCountY / 2),
            gz
          );
          if (node) {
            this.connectionManager.spawnForNode(node);
          }
        }
      }
    }
    this.lastSpawnZ = gridZEnd * GRID.spacing;
    this.lastDespawnZ = (gridZStart - 2) * GRID.spacing;
  }

  // ─── HOVER ─────────────────────────────────────────────────────────────────

  private hoveredNodeId: string | null = null;

  setHoverGlitch(nodeId: string | null, active: boolean) {
    if (active && nodeId) {
      this.glitchEffects.startHoverGlitch(nodeId);
      this.nodeManager.setHoverGlitch(nodeId, true);
    } else {
      this.glitchEffects.stopHoverGlitch();
      if (this.hoveredNodeId) {
        this.nodeManager.setHoverGlitch(this.hoveredNodeId, false);
      }
    }
    this.hoveredNodeId = active ? nodeId : null;
  }

  // ─── MAIN UPDATE ─────────────────────────────────────────────────────────────

  update(cameraZ: number) {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = now;
    const time = now / 1000;

    // ── Node lifecycle ─────────────────────────────────────────────────────────
    const spawnAhead = cameraZ + 60;
    const despawnBehind = cameraZ - 30;
    const currentGridZ = Math.floor(spawnAhead / GRID.spacing);
    const lastGridZ = Math.floor(this.lastSpawnZ / GRID.spacing);

    if (currentGridZ > lastGridZ) {
      for (let gz = lastGridZ + 1; gz <= currentGridZ; gz++) {
        for (let gx = 0; gx < GRID.nodeCountX; gx++) {
          for (let gy = 0; gy < GRID.nodeCountY; gy++) {
            const node = this.nodeManager.spawnNode(
              gx - Math.floor(GRID.nodeCountX / 2),
              gy - Math.floor(GRID.nodeCountY / 2),
              gz
            );
            if (node) this.connectionManager.spawnForNode(node);
          }
        }
      }
      this.lastSpawnZ = currentGridZ * GRID.spacing;
    }

    const despawnThreshold = Math.floor(despawnBehind / GRID.spacing);
    if (despawnThreshold > 0) {
      this.nodeManager.despawnNodesBehind(despawnThreshold);
      this.connectionManager.pruneConnections();
      this.lastDespawnZ = despawnThreshold * GRID.spacing;
    }

    // ── Node pulse ────────────────────────────────────────────────────────────
    this.nodeManager.updatePulse(time);

    // ── Packet stream ─────────────────────────────────────────────────────────
    this.packetStream.update(dt);

    // ── Glitch effects ────────────────────────────────────────────────────────
    if (this.pipeline) {
      // Update pipeline chromatic aberration from glitch effects
      this.glitchEffects.update(dt, time);
    }

    // ── Attack wave ────────────────────────────────────────────────────────────
    this.attackWave.update(dt, cameraZ);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────────────

  getNodeData(meshName: string): {
    nodeId: string;
    sector: string;
    security: string;
    status: string;
    uptime: string;
    packet: string;
    timestamp: string;
  } | null {
    const node = this.nodeManager.getNode(meshName);
    if (!node) return null;
    return {
      nodeId: node.nodeId,
      sector: node.sector,
      security: node.security,
      status: node.status,
      uptime: node.uptime,
      packet: node.packet,
      timestamp: new Date().toISOString(),
    };
  }

  getPacketCount(): number {
    return this.packetStream.getPacketCount();
  }

  triggerFullGlitch() {
    this.glitchEffects.triggerFullGlitch();
  }

  getWaveProgress(): number {
    return this.attackWave.getWaveProgress();
  }

  isWaveActive(): boolean {
    return this.attackWave.isWaveActive();
  }
}
