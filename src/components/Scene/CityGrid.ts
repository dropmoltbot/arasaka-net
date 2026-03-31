"use client";

import {
  Scene as BabylonScene,
  MeshBuilder,
  Vector3,
  Color3,
  StandardMaterial,
  Mesh,
  AbstractMesh,
  GlowLayer,
  PointLight,
  LinesMesh,
  InstancedMesh,
} from "@babylonjs/core";
import { GRID, COLORS, SCENE, TERMINAL } from "@/lib/constants";
import { randomRange, getJitter } from "@/lib/utils";

interface NodeMesh {
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
}

export class CityGrid {
  private scene: BabylonScene;
  private glow: GlowLayer;
  private onClick: (meshName: string) => void;
  private nodes: NodeMesh[] = [];
  private lines: LinesMesh[] = [];
  private gridOffset = 0;
  private spawnedNodeIds = new Set<string>();

  // Base node mesh for instancing
  private baseNode: Mesh | null = null;
  private nodeMaterial: StandardMaterial | null = null;
  private lightMaterial: StandardMaterial | null = null;

  // Z spawn window
  private lastSpawnZ = 0;
  private lastDespawnZ = 0;

  constructor(
    scene: BabylonScene,
    glow: GlowLayer,
    onClick: (meshName: string) => void
  ) {
    this.scene = scene;
    this.glow = glow;
    this.onClick = onClick;
    this.initBaseAssets();
    this.spawnInitialGrid();
    this.setupClickHandler();
  }

  private initBaseAssets() {
    // Base sphere for node mesh
    this.baseNode = MeshBuilder.CreateSphere(
      "baseNode",
      { diameter: GRID.nodeRadius * 2, segments: 8 },
      this.scene
    );

    this.nodeMaterial = new StandardMaterial("nodeMat", this.scene);
    this.nodeMaterial.emissiveColor = new Color3(
      0,
      0.96,
      1
    ) as unknown as Color3;
    this.nodeMaterial.disableLighting = true;
    this.baseNode.material = this.nodeMaterial;
    this.baseNode.isVisible = false;
  }

  private generateNodeData(
    nodeId: string
  ): {
    sector: string;
    security: string;
    status: string;
    uptime: string;
    packet: string;
  } {
    const { sectors, securityLevels, statuses } = TERMINAL.nodeData;
    return {
      sector: sectors[Math.floor(Math.random() * sectors.length)],
      security: securityLevels[Math.floor(Math.random() * securityLevels.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      uptime: `${Math.floor(randomRange(99.1, 99.99) * 100) / 100}%`,
      packet: `PKT-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`,
    };
  }

  private makeNodeId(x: number, y: number, z: number): string {
    return `node_${x}_${y}_${z}`;
  }

  private spawnNode(gridX: number, gridY: number, gridZ: number): NodeMesh | null {
    const nodeId = this.makeNodeId(gridX, gridY, gridZ);
    if (this.spawnedNodeIds.has(nodeId)) return null;

    const x = gridX * GRID.spacing + getJitter(GRID.jitter);
    const y = gridY * GRID.spacing + getJitter(GRID.jitter);
    const z = gridZ * GRID.spacing;

    const mesh = this.baseNode!.createInstance(nodeId);
    mesh.position = new Vector3(x, y, z);

    // Store metadata
    const meta = this.generateNodeData(nodeId);
    (mesh as any).metadata = { nodeId, ...meta };

    // Point light at node
    const light = new PointLight(
      `light_${nodeId}`,
      new Vector3(x, y, z),
      this.scene
    );
    light.diffuse = new Color3(0, 0.96, 1) as unknown as Color3;
    light.intensity = SCENE.lightIntensity;
    light.range = SCENE.lightRange;

    // Pulse phase randomization
    const pulsePhase = Math.random() * Math.PI * 2;

    const node: NodeMesh = {
      mesh,
      light,
      basePosition: new Vector3(x, y, z),
      gridX,
      gridY,
      gridZ,
      nodeId,
      ...meta,
      pulsePhase,
    };

    this.nodes.push(node);
    this.spawnedNodeIds.add(nodeId);
    return node;
  }

  private spawnInitialGrid() {
    // Spawn a 3D grid slice at Z=0
    const gridZStart = Math.floor(this.lastSpawnZ / GRID.spacing);
    const gridZEnd = gridZStart + 6;

    for (let gz = gridZStart; gz <= gridZEnd; gz++) {
      for (let gx = 0; gx < GRID.nodeCountX; gx++) {
        for (let gy = 0; gy < GRID.nodeCountY; gy++) {
          this.spawnNode(
            gx - Math.floor(GRID.nodeCountX / 2),
            gy - Math.floor(GRID.nodeCountY / 2),
            gz
          );
        }
      }
    }
    this.lastSpawnZ = gridZEnd * GRID.spacing;
    this.lastDespawnZ = (gridZStart - 2) * GRID.spacing;
  }

  private spawnConnections(node: NodeMesh) {
    const { gridX, gridY, gridZ, basePosition } = node;
    const neighborOffsets = [
      [1, 0, 0],
      [0, 1, 0],
      [-1, 0, 0],
      [0, -1, 0],
    ];

    for (const [dx, dy, dz] of neighborOffsets) {
      const nId = this.makeNodeId(gridX + dx, gridY + dy, gridZ + dz);
      if (!this.spawnedNodeIds.has(nId)) continue;

      // Check if line already exists
      const lineId = [node.nodeId, nId].sort().join("-");
      if (this.lines.find((l) => l.name === lineId)) continue;

      const neighbor = this.nodes.find((n) => n.nodeId === nId);
      if (!neighbor) continue;

      const positions = [
        basePosition,
        neighbor.basePosition,
      ];

      try {
        const line = MeshBuilder.CreateLines(
          lineId,
          { points: positions, updatable: false },
          this.scene
        );
        line.color = new Color3(
          0.1,
          0.1,
          0.18
        ) as unknown as Color3;
        this.lines.push(line);
      } catch {
        // Lines may fail if points are identical — skip
      }
    }
  }

  private setupClickHandler() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === 1) {
        // POINTERPICK
        const pickResult = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY
        );
        if (pickResult?.hit && pickResult.pickedMesh) {
          const name = pickResult.pickedMesh.name;
          if (name.startsWith("node_")) {
            this.onClick(name);
          }
        }
      }
    });
  }

  update(cameraZ: number) {
    const spawnAhead = cameraZ + 60;
    const despawnBehind = cameraZ - 30;

    // Spawn new Z layers ahead of camera
    const currentGridZ = Math.floor(spawnAhead / GRID.spacing);
    const lastGridZ = Math.floor(this.lastSpawnZ / GRID.spacing);

    if (currentGridZ > lastGridZ) {
      for (let gz = lastGridZ + 1; gz <= currentGridZ; gz++) {
        for (let gx = 0; gx < GRID.nodeCountX; gx++) {
          for (let gy = 0; gy < GRID.nodeCountY; gy++) {
            const node = this.spawnNode(
              gx - Math.floor(GRID.nodeCountX / 2),
              gy - Math.floor(GRID.nodeCountY / 2),
              gz
            );
            if (node) {
              this.spawnConnections(node);
            }
          }
        }
      }
      this.lastSpawnZ = currentGridZ * GRID.spacing;
    }

    // Despawn nodes behind camera
    const despawnThreshold = Math.floor(despawnBehind / GRID.spacing);
    const nodesToRemove = this.nodes.filter(
      (n) => n.gridZ < despawnThreshold
    );
    for (const node of nodesToRemove) {
      node.mesh.dispose();
      node.light.dispose();
      this.nodes = this.nodes.filter((n) => n !== node);
      this.spawnedNodeIds.delete(node.nodeId);
    }

    // Despawn old lines
    this.lines = this.lines.filter((line) => {
      const parts = line.name.split("-");
      if (parts.length !== 2) return false;
      const [a, b] = parts;
      const aExists = this.spawnedNodeIds.has(a);
      const bExists = this.spawnedNodeIds.has(b);
      if (!aExists || !bExists) {
        line.dispose();
        return false;
      }
      return true;
    });

    // Animate node pulse (light intensity oscillation)
    const time = performance.now() / 1000;
    for (const node of this.nodes) {
      const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.15 + 0.25;
      node.light.intensity = pulse;
    }
  }

  getNodeData(meshName: string): {
    nodeId: string;
    sector: string;
    security: string;
    status: string;
    uptime: string;
    packet: string;
    timestamp: string;
  } | null {
    const node = this.nodes.find((n) => n.nodeId === meshName);
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
}
