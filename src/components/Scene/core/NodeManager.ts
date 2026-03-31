"use client";

import {
  Scene as BabylonScene,
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  Mesh,
  InstancedMesh,
  PointLight,
  AbstractMesh,
} from "@babylonjs/core";
import { GRID, SCENE, TERMINAL } from "@/lib/constants";
import { randomRange, getJitter } from "@/lib/utils";

export interface NodeMesh {
  mesh: InstancedMesh | Mesh;
  light: PointLight;
  basePosition: Vector3;
  gridX: number;
  gridY: number;
  gridZ: number;
  nodeId: string;
  sector: string;
  security: string;
  status: string;
  uptime: string;
  packet: string;
  pulsePhase: number;
  isStruck: boolean; // attack wave hit
}

export interface NodeCreationCallbacks {
  onHover: () => void;
  onNodeClick: (meshName: string) => void;
}

export class NodeManager {
  private scene: BabylonScene;
  private glow: import("@babylonjs/core").GlowLayer;
  private baseNode: Mesh | null = null;
  private nodeMaterial: StandardMaterial | null = null;
  private nodes: NodeMesh[] = [];
  private spawnedNodeIds = new Set<string>();
  private hoveredNodeId: string | null = null;
  private callbacks: NodeCreationCallbacks;

  constructor(
    scene: BabylonScene,
    glow: import("@babylonjs/core").GlowLayer,
    callbacks: NodeCreationCallbacks
  ) {
    this.scene = scene;
    this.glow = glow;
    this.callbacks = callbacks;
    this.initBaseAssets();
    this.setupInteraction();
  }

  // ─── ASSETS ─────────────────────────────────────────────────────────────────

  private initBaseAssets() {
    this.baseNode = MeshBuilder.CreateSphere(
      "baseNode",
      { diameter: GRID.nodeRadius * 2, segments: 8 },
      this.scene
    );

    this.nodeMaterial = new StandardMaterial("nodeMat", this.scene);
    this.nodeMaterial.emissiveColor = new Color3(0, 0.96, 1) as unknown as Color3;
    this.nodeMaterial.disableLighting = true;
    this.baseNode.material = this.nodeMaterial;
    this.baseNode.isVisible = false;
  }

  // ─── INTERACTION ─────────────────────────────────────────────────────────────

  private setupInteraction() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      const type = pointerInfo.type;
      // PointerDown = 1, PointerUp = 2, PointerMove = 4
      if (type === 1) {
        // click
        const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        if (pickResult?.hit && pickResult.pickedMesh) {
          const name = pickResult.pickedMesh.name;
          if (name.startsWith("node_")) {
            this.callbacks.onNodeClick(name);
          }
        }
      } else if (type === 4) {
        // hover move
        const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        const hoveredName =
          pickResult?.hit && pickResult.pickedMesh ? pickResult.pickedMesh.name : null;
        const newHoveredId = hoveredName?.startsWith("node_") ? hoveredName : null;

        if (newHoveredId !== this.hoveredNodeId) {
          if (this.hoveredNodeId) {
            const prev = this.nodes.find((n) => n.nodeId === this.hoveredNodeId);
            if (prev) this.setHoverState(prev, false);
          }
          if (newHoveredId) {
            const node = this.nodes.find((n) => n.nodeId === newHoveredId);
            if (node) {
              this.setHoverState(node, true);
              this.callbacks.onHover();
            }
          }
          this.hoveredNodeId = newHoveredId;
        }
      }
    });
  }

  private setHoverState(node: NodeMesh, isHovered: boolean) {
    const mat = node.mesh.material as StandardMaterial;
    if (!mat) return;
    mat.emissiveColor = isHovered
      ? (new Color3(1, 0, 0.43) as unknown as Color3)
      : (new Color3(0, 0.96, 1) as unknown as Color3);
    node.light.intensity = isHovered ? 1.5 : 0.3;
  }

  // ─── SPAWNING ────────────────────────────────────────────────────────────────

  private makeNodeId(x: number, y: number, z: number): string {
    return `node_${x}_${y}_${z}`;
  }

  private generateMeta(nodeId: string) {
    const { sectors, securityLevels, statuses } = TERMINAL.nodeData;
    return {
      sector: sectors[Math.floor(Math.random() * sectors.length)],
      security: securityLevels[Math.floor(Math.random() * securityLevels.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      uptime: `${Math.floor(randomRange(99.1, 99.99) * 100) / 100}%`,
      packet: `PKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  }

  spawnNode(gridX: number, gridY: number, gridZ: number): NodeMesh | null {
    const nodeId = this.makeNodeId(gridX, gridY, gridZ);
    if (this.spawnedNodeIds.has(nodeId)) return null;

    const x = gridX * GRID.spacing + getJitter(GRID.jitter);
    const y = gridY * GRID.spacing + getJitter(GRID.jitter);
    const z = gridZ * GRID.spacing;

    const mesh = this.baseNode!.createInstance(nodeId);
    mesh.position = new Vector3(x, y, z);

    const meta = this.generateMeta(nodeId);
    (mesh as any).metadata = { nodeId, ...meta };

    const light = new PointLight(`light_${nodeId}`, new Vector3(x, y, z), this.scene);
    light.diffuse = new Color3(0, 0.96, 1) as unknown as Color3;
    light.intensity = SCENE.lightIntensity;
    light.range = SCENE.lightRange;

    const node: NodeMesh = {
      mesh,
      light,
      basePosition: new Vector3(x, y, z),
      gridX,
      gridY,
      gridZ,
      nodeId,
      ...meta,
      pulsePhase: Math.random() * Math.PI * 2,
      isStruck: false,
    };

    this.nodes.push(node);
    this.spawnedNodeIds.add(nodeId);
    return node;
  }

  spawnInitialBatch(startGX: number, startGY: number, startGZ: number, countX: number, countY: number, countZ: number) {
    for (let gz = startGZ; gz < startGZ + countZ; gz++) {
      for (let gx = 0; gx < countX; gx++) {
        for (let gy = 0; gy < countY; gy++) {
          this.spawnNode(
            gx - Math.floor(countX / 2),
            gy - Math.floor(countY / 2),
            gz
          );
        }
      }
    }
  }

  // ─── DESPAWN ─────────────────────────────────────────────────────────────────

  despawnNodesBehind(maxGridZ: number): NodeMesh[] {
    const toRemove = this.nodes.filter((n) => n.gridZ < maxGridZ);
    for (const node of toRemove) {
      node.mesh.dispose();
      node.light.dispose();
      this.nodes = this.nodes.filter((n) => n !== node);
      this.spawnedNodeIds.delete(node.nodeId);
    }
    return toRemove;
  }

  // ─── ATTACK WAVE ─────────────────────────────────────────────────────────────

  /** Strike nodes at and behind the given Z — used by AttackWave */
  strikeNodesAtZ(worldZ: number, onStruck: (node: NodeMesh) => void) {
    for (const node of this.nodes) {
      if (node.basePosition.z <= worldZ && !node.isStruck) {
        node.isStruck = true;
        onStruck(node);
        // reset flag after recovery
        setTimeout(() => { node.isStruck = false; }, 3000);
      }
    }
  }

  /** Immediately set emissive to 0 on struck nodes */
  blackoutNode(node: NodeMesh) {
    const mat = node.mesh.material as StandardMaterial;
    if (mat) mat.emissiveColor = new Color3(0, 0, 0) as unknown as Color3;
    node.light.intensity = 0;
  }

  /** Flash-recover a node back to cyan */
  recoverNode(node: NodeMesh) {
    const mat = node.mesh.material as StandardMaterial;
    if (mat) {
      // quick flash to white then settle to cyan
      mat.emissiveColor = new Color3(0.5, 1, 1) as unknown as Color3;
      setTimeout(() => {
        if (mat) mat.emissiveColor = new Color3(0, 0.96, 1) as unknown as Color3;
      }, 120);
    }
    node.light.intensity = SCENE.lightIntensity;
  }

  // ─── PULSE ──────────────────────────────────────────────────────────────────

  updatePulse(time: number) {
    for (const node of this.nodes) {
      const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.15 + 0.25;
      node.light.intensity = pulse;
    }
  }

  // ─── HOVER HIGHLIGHT ─────────────────────────────────────────────────────────

  setHoverGlitch(nodeId: string, active: boolean) {
    const node = this.nodes.find((n) => n.nodeId === nodeId);
    if (!node) return;
    const mat = node.mesh.material as StandardMaterial;
    if (!mat) return;
    if (active) {
      mat.emissiveColor = new Color3(1, 0, 0.43) as unknown as Color3;
      node.light.intensity = 1.5;
    } else {
      mat.emissiveColor = new Color3(0, 0.96, 1) as unknown as Color3;
      node.light.intensity = 0.3;
    }
  }

  // ─── QUERY ──────────────────────────────────────────────────────────────────

  getNodes(): NodeMesh[] { return this.nodes; }
  getNode(nodeId: string): NodeMesh | undefined { return this.nodes.find((n) => n.nodeId === nodeId); }
  hasNode(nodeId: string): boolean { return this.spawnedNodeIds.has(nodeId); }
  getNodeCount(): number { return this.nodes.length; }
}
