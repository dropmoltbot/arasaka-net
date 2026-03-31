"use client";

import {
  Scene as BabylonScene,
  MeshBuilder,
  Vector3,
  Color3,
  LinesMesh,
} from "@babylonjs/core";
import { NodeManager } from "./NodeManager";

export interface ConnectionPath {
  line: LinesMesh;
  /** Cached start/end for packet lerping */
  startPos: Vector3;
  endPos: Vector3;
  /** Normalised direction vector (used for packet offset) */
  direction: Vector3;
}

export class ConnectionManager {
  private scene: BabylonScene;
  private nodeManager: NodeManager;
  private connections: ConnectionPath[] = [];

  constructor(scene: BabylonScene, nodeManager: NodeManager) {
    this.scene = scene;
    this.nodeManager = nodeManager;
  }

  // ─── SPAWN CONNECTIONS FOR A NODE ────────────────────────────────────────────

  spawnForNode(node: import("./NodeManager").NodeMesh) {
    const { gridX, gridY, gridZ, basePosition } = node;
    const offsets: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [-1, 0, 0],
      [0, -1, 0],
    ];

    for (const [dx, dy, dz] of offsets) {
      const nx = gridX + dx;
      const ny = gridY + dy;
      const nz = gridZ + dz;

      if (!this.nodeManager.hasNode(`node_${nx}_${ny}_${nz}`)) continue;

      // deduplicate
      const lineId = [node.nodeId, `node_${nx}_${ny}_${nz}`].sort().join("-");
      if (this.connections.find((c) => c.line.name === lineId)) continue;

      const neighborPos = new Vector3(
        nx * 8, // will be jittered but we use grid coords × spacing
        ny * 8,
        nz * 8
      );

      // Find actual node basePosition
      const neighbor = this.nodeManager.getNode(`node_${nx}_${ny}_${nz}`);
      if (!neighbor) continue;

      const positions = [basePosition.clone(), neighbor.basePosition.clone()];
      const dir = positions[1].subtract(positions[0]).normalize();

      try {
        const line = MeshBuilder.CreateLines(
          lineId,
          { points: positions, updatable: false },
          this.scene
        );
        line.color = new Color3(0.1, 0.1, 0.18) as unknown as Color3;

        this.connections.push({ line, startPos: positions[0], endPos: positions[1], direction: dir });
      } catch {
        // degenerate line
      }
    }
  }

  // ─── CULL ───────────────────────────────────────────────────────────────────

  pruneConnections() {
    this.connections = this.connections.filter((conn) => {
      const parts = conn.line.name.split("-");
      if (parts.length !== 2) { conn.line.dispose(); return false; }
      const aExists = this.nodeManager.hasNode(parts[0]);
      const bExists = this.nodeManager.hasNode(parts[1]);
      if (!aExists || !bExists) { conn.line.dispose(); return false; }
      return true;
    });
  }

  // ─── QUERY ──────────────────────────────────────────────────────────────────

  getConnections(): ConnectionPath[] { return this.connections; }

  getRandomConnection(): ConnectionPath | null {
    if (this.connections.length === 0) return null;
    return this.connections[Math.floor(Math.random() * this.connections.length)];
  }

  getConnectionCount(): number { return this.connections.length; }
}
