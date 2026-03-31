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

interface DataPacket {
  instance: InstancedMesh;
  material: StandardMaterial;
  startPos: Vector3;
  endPos: Vector3;
  progress: number;       // 0..1
  speed: number;           // units per second
  size: number;           // 0.06..0.14
  corrupted: boolean;
  color: Color3;
  arrivalCallback: () => void;
}

interface LineWithPositions {
  line: LinesMesh;
  positions: Vector3[];
}

export class CityGrid {
  private scene: BabylonScene;
  private glow: GlowLayer;
  private onClick: (meshName: string) => void;
  private onHover: () => void;
  private nodes: NodeMesh[] = [];
  private lines: LineWithPositions[] = [];
  private gridOffset = 0;
  private spawnedNodeIds = new Set<string>();
  private hoveredNodeId: string | null = null;

  // Base node mesh for instancing
  private baseNode: Mesh | null = null;
  private nodeMaterial: StandardMaterial | null = null;
  private lightMaterial: StandardMaterial | null = null;

  // Z spawn window
  private lastSpawnZ = 0;
  private lastDespawnZ = 0;

  // ─── DATASTREAM PARTICLES ───
  private packetPool: DataPacket[] = [];
  private basePacket: Mesh | null = null;
  private healthyMat: StandardMaterial | null = null;
  private corruptedMat: StandardMaterial | null = null;
  private burstTimer = 0;
  private readonly MAX_PACKETS = 180;
  private readonly PACKET_SPAWN_INTERVAL = 0.08; // seconds between spawns
  private timeSinceLastPacket = 0;

  constructor(
    scene: BabylonScene,
    glow: GlowLayer,
    onClick: (meshName: string) => void,
    onHover: () => void
  ) {
    this.scene = scene;
    this.glow = glow;
    this.onClick = onClick;
    this.onHover = onHover;
    this.initBaseAssets();
    this.initPacketAssets();
    this.spawnInitialGrid();
    this.setupClickHandler();
  }

  // ─── NODE SPAWNING ───

  private initBaseAssets() {
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

    const meta = this.generateNodeData(nodeId);
    (mesh as any).metadata = { nodeId, ...meta };

    const light = new PointLight(
      `light_${nodeId}`,
      new Vector3(x, y, z),
      this.scene
    );
    light.diffuse = new Color3(0, 0.96, 1) as unknown as Color3;
    light.intensity = SCENE.lightIntensity;
    light.range = SCENE.lightRange;

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

      const lineId = [node.nodeId, nId].sort().join("-");
      if (this.lines.find((lp) => lp.line.name === lineId)) continue;

      const neighbor = this.nodes.find((n) => n.nodeId === nId);
      if (!neighbor) continue;

      const positions = [basePosition, neighbor.basePosition];

      try {
        const line = MeshBuilder.CreateLines(
          lineId,
          { points: positions, updatable: false },
          this.scene
        );
        line.color = new Color3(0.1, 0.1, 0.18) as unknown as Color3;
        this.lines.push({ line, positions });
      } catch {
        // Skip if points are identical
      }
    }
  }

  private setupClickHandler() {
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === 1) {
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
      } else if (pointerInfo.type === 4) {
        const pickResult = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY
        );
        const hoveredName = pickResult?.hit && pickResult.pickedMesh
          ? pickResult.pickedMesh.name
          : null;
        const newHoveredId = hoveredName?.startsWith("node_") ? hoveredName : null;

        if (newHoveredId !== this.hoveredNodeId) {
          if (this.hoveredNodeId) {
            const prevNode = this.nodes.find((n) => n.nodeId === this.hoveredNodeId);
            if (prevNode) this.setNodeHoverState(prevNode, false);
          }
          if (newHoveredId) {
            const node = this.nodes.find((n) => n.nodeId === newHoveredId);
            if (node) this.setNodeHoverState(node, true);
          }
          this.hoveredNodeId = newHoveredId;
        }
      }
    });
  }

  private setNodeHoverState(node: NodeMesh, isHovered: boolean) {
    if (node.mesh.material) {
      (node.mesh.material as StandardMaterial).emissiveColor = isHovered
        ? new Color3(1, 0, 0.43) as unknown as Color3
        : new Color3(0, 0.96, 1) as unknown as Color3;
    }
    node.light.intensity = isHovered ? 1.5 : 0.3;
    if (isHovered) this.onHover();
  }

  // ─── DATASTREAM PARTICLE SYSTEM ───

  private initPacketAssets() {
    // Base packet mesh — tiny sphere
    this.basePacket = MeshBuilder.CreateSphere(
      "basePacket",
      { diameter: 1, segments: 4 },
      this.scene
    );
    this.basePacket.isVisible = false;

    // Healthy packet: cyan glow
    this.healthyMat = new StandardMaterial("packetHealthy", this.scene);
    this.healthyMat.emissiveColor = new Color3(0, 1, 1) as unknown as Color3;
    this.healthyMat.disableLighting = true;

    // Corrupted packet: magenta glitch
    this.corruptedMat = new StandardMaterial("packetCorrupt", this.scene);
    this.corruptedMat.emissiveColor = new Color3(1, 0, 0.43) as unknown as Color3;
    this.corruptedMat.disableLighting = true;
  }

  private spawnPacket() {
    if (this.packetPool.length >= this.MAX_PACKETS) return;
    if (this.nodes.length < 2) return;
    if (this.lines.length === 0) return;

    // Pick a random active line
    const lineEntry = this.lines[Math.floor(Math.random() * this.lines.length)];
    const positions = lineEntry.positions;
    if (!positions || positions.length < 2) return;

    const startPos = positions[0].clone();
    const endPos = positions[1].clone();

    // 15% chance of corrupted packet
    const corrupted = Math.random() < 0.15;
    const speed = randomRange(1.5, 4.5);
    const size = randomRange(0.06, 0.14);

    // Color variation
    let color: Color3;
    if (corrupted) {
      color = new Color3(1, 0, 0.43) as unknown as Color3;
    } else {
      const hue = Math.random();
      if (hue < 0.6) {
        color = new Color3(0, 0.96, 1) as unknown as Color3; // cyan
      } else if (hue < 0.85) {
        color = new Color3(1, 0.75, 0) as unknown as Color3; // amber
      } else {
        color = new Color3(0.3, 1, 0.4) as unknown as Color3; // green
      }
    }

    const mat = corrupted ? this.corruptedMat! : this.healthyMat!.clone(`pm_${Date.now()}_${Math.random()}`);
    mat.emissiveColor = color as unknown as Color3;

    const instance = this.basePacket!.createInstance(`packet_${Date.now()}_${Math.random()}`);
    instance.scaling = new Vector3(size, size, size);
    instance.material = mat;

    const packet: DataPacket = {
      instance,
      material: mat,
      startPos,
      endPos,
      progress: 0,
      speed,
      size,
      corrupted,
      color,
      arrivalCallback: () => {
        // Brief arrival flash — scale up then dispose
        const inst = packet.instance;
        const startSize = size;
        let t = 0;
        const flash = this.scene.onBeforeRenderObservable.add(() => {
          t += this.scene.getEngine().getDeltaTime() / 80;
          if (t >= 1) {
            inst.dispose();
            mat.dispose();
            this.scene.onBeforeRenderObservable.remove(flash);
          } else {
            const s = startSize * (1 + 1.5 * Math.sin(t * Math.PI));
            inst.scaling = new Vector3(s, s, s);
            (mat as StandardMaterial).emissiveColor = new Color3(
              color.r * (1 - t) + 1 * t,
              color.g * (1 - t) + 1 * t,
              color.b * (1 - t) + 1 * t
            ) as unknown as Color3;
          }
        });
      },
    };

    this.packetPool.push(packet);
  }

  private updatePackets(dt: number) {
    // Spawn packets periodically
    this.timeSinceLastPacket += dt;
    const spawnInterval = 0.05 + Math.random() * 0.06; // 50-110ms
    if (this.timeSinceLastPacket >= spawnInterval) {
      this.spawnPacket();
      this.timeSinceLastPacket = 0;
    }

    // Burst: occasionally spawn a burst of packets along one line
    this.burstTimer += dt;
    if (this.burstTimer > 8 + Math.random() * 12) {
      this.burstTimer = 0;
      const burstCount = Math.floor(randomRange(5, 12));
      for (let i = 0; i < burstCount; i++) {
        setTimeout(() => this.spawnPacket(), i * 30);
      }
    }

    // Update each packet
    const toRemove: DataPacket[] = [];
    for (const packet of this.packetPool) {
      // Move along path
      const pathLen = Vector3.Distance(packet.startPos, packet.endPos);
      const moveAmount = (packet.speed * dt) / pathLen;
      packet.progress = Math.min(packet.progress + moveAmount, 1);

      // Interpolate position
      const pos = Vector3.Lerp(packet.startPos, packet.endPos, packet.progress);
      packet.instance.position = pos;

      // Glitch wobble for corrupted packets
      if (packet.corrupted) {
        const wobble = Math.sin(Date.now() * 0.05) * 0.08;
        packet.instance.position.x += wobble;
        packet.instance.position.y += Math.cos(Date.now() * 0.07) * 0.06;
      }

      // Scale pulse along journey
      const pulseFactor = 1 + 0.3 * Math.sin(packet.progress * Math.PI * 2);
      const s = packet.size * pulseFactor;
      packet.instance.scaling = new Vector3(s, s, s);

      // Brightness ramp: fade in at start, fade out at end
      const fadeIn = Math.min(packet.progress * 8, 1);
      const fadeOut = packet.progress > 0.8 ? (1 - packet.progress) / 0.2 : 1;
      const brightness = fadeIn * fadeOut;
      const r = packet.color.r * brightness;
      const g = packet.color.g * brightness;
      const b = packet.color.b * brightness;
      (packet.material as StandardMaterial).emissiveColor = new Color3(r, g, b) as unknown as Color3;

      // Arrival
      if (packet.progress >= 1) {
        packet.arrivalCallback();
        toRemove.push(packet);
      }
    }

    // Cleanup arrived packets
    for (const packet of toRemove) {
      const idx = this.packetPool.indexOf(packet);
      if (idx !== -1) this.packetPool.splice(idx, 1);
    }
  }

  // ─── MAIN UPDATE ───

  update(cameraZ: number) {
    // Node spawn/despawn
    const spawnAhead = cameraZ + 60;
    const despawnBehind = cameraZ - 30;

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
            if (node) this.spawnConnections(node);
          }
        }
      }
      this.lastSpawnZ = currentGridZ * GRID.spacing;
    }

    const despawnThreshold = Math.floor(despawnBehind / GRID.spacing);
    const nodesToRemove = this.nodes.filter((n) => n.gridZ < despawnThreshold);
    for (const node of nodesToRemove) {
      node.mesh.dispose();
      node.light.dispose();
      this.nodes = this.nodes.filter((n) => n !== node);
      this.spawnedNodeIds.delete(node.nodeId);
    }

    this.lines = this.lines.filter((lp) => {
      const aExists = this.spawnedNodeIds.has(lp.line.name.split("-")[0]);
      const bExists = this.spawnedNodeIds.has(lp.line.name.split("-")[1]);
      if (!aExists || !bExists) { lp.line.dispose(); return false; }
      return true;
    });

    // Node pulse
    const time = performance.now() / 1000;
    for (const node of this.nodes) {
      const pulse = Math.sin(time * 1.5 + node.pulsePhase) * 0.15 + 0.25;
      node.light.intensity = pulse;
    }

    // Datastream packets
    const dt = 1 / 60; // fixed timestep for packet updates
    this.updatePackets(dt);
  }

  // ─── PUBLIC API ───

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

  getPacketCount(): number {
    return this.packetPool.length;
  }
}
