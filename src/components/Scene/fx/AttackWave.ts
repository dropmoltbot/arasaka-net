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
import { NodeManager } from "../core/NodeManager";
import { GlitchEffects } from "./GlitchEffects";

export interface AttackWaveCallbacks {
  onWaveStart: () => void;
  onWavePass: () => void;
  onDronePitch: (pitch: number) => void;
}

export class AttackWave {
  private scene: BabylonScene;
  private nodeManager: NodeManager;
  private glitchEffects: GlitchEffects;
  private callbacks: AttackWaveCallbacks;

  private waveTimer = 0;
  private nextWave = 60 + Math.random() * 30; // 60-90s
  private isActive = false;
  private waveProgress = 0;   // 0..1
  private waveDuration = 4.0; // seconds to sweep
  private waveZ = 0;          // current world Z of wave front
  private waveStartZ = 0;     // where wave originates (far Z)

  // Particle wall
  private wallParticles: InstancedMesh[] = [];
  private wallMaterial: StandardMaterial | null = null;
  private wallBase: Mesh | null = null;
  private wallMaxCount = 80;

  constructor(
    scene: BabylonScene,
    nodeManager: NodeManager,
    glitchEffects: GlitchEffects,
    callbacks: AttackWaveCallbacks
  ) {
    this.scene = scene;
    this.nodeManager = nodeManager;
    this.glitchEffects = glitchEffects;
    this.callbacks = callbacks;
    this.initWall();
  }

  // ─── INIT PARTICLE WALL ───────────────────────────────────────────────────────

  private initWall() {
    this.wallBase = MeshBuilder.CreateSphere(
      "waveParticle",
      { diameter: 0.3, segments: 4 },
      this.scene
    );
    this.wallBase.isVisible = false;

    this.wallMaterial = new StandardMaterial("waveMat", this.scene);
    this.wallMaterial.emissiveColor = new Color3(1, 0.2, 0) as unknown as Color3;
    this.wallMaterial.disableLighting = true;
  }

  // ─── TRIGGER ─────────────────────────────────────────────────────────────────

  private trigger() {
    this.isActive = true;
    this.waveProgress = 0;
    this.waveTimer = 0;
    this.nextWave = 60 + Math.random() * 30;
    this.callbacks.onWaveStart();
    this.glitchEffects.startWaveGlitch();
  }

  // ─── SPAWN WALL PARTICLES AT Z ────────────────────────────────────────────────

  private spawnWallAtZ(worldZ: number) {
    if (!this.wallBase || !this.wallMaterial) return;

    // Remove old particles
    for (const p of this.wallParticles) p.dispose();
    this.wallParticles = [];

    const count = Math.min(this.wallMaxCount, this.nodeManager.getNodeCount());
    for (let i = 0; i < count; i++) {
      const inst = this.wallBase.createInstance(`wp_${worldZ}_${i}`);
      inst.position = new Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 60,
        worldZ + (Math.random() - 0.5) * 2
      );
      inst.material = this.wallMaterial;
      this.wallParticles.push(inst);
    }
  }

  // ─── STRIKE NODES ─────────────────────────────────────────────────────────────

  private strikeNodesAtWaveFront(waveZ: number) {
    this.nodeManager.strikeNodesAtZ(waveZ, (node) => {
      // Blackout then recover with flash
      this.nodeManager.blackoutNode(node);
      setTimeout(() => {
        this.nodeManager.recoverNode(node);
      }, 400 + Math.random() * 200);
    });
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  update(dt: number, cameraZ: number) {
    if (!this.isActive) {
      this.waveTimer += dt;
      if (this.waveTimer >= this.nextWave) {
        this.trigger();
      }
      return;
    }

    this.waveTimer += dt;
    this.waveProgress = Math.min(this.waveTimer / this.waveDuration, 1);

    // Wave sweeps from far Z toward camera
    const farZ = cameraZ + 80;
    const nearZ = cameraZ - 10;
    this.waveZ = farZ - (farZ - nearZ) * this.waveProgress;

    // Color shift: red → orange as wave approaches
    if (this.wallMaterial) {
      const r = 1;
      const g = 0.2 + this.waveProgress * 0.4;
      const b = 0;
      this.wallMaterial.emissiveColor = new Color3(r, g, b) as unknown as Color3;
    }

    // Spawn/update wall particles at wave front
    this.spawnWallAtZ(this.waveZ);

    // Strike nodes at wave front
    if (this.waveProgress < 1) {
      this.strikeNodesAtWaveFront(this.waveZ);
    }

    // Drone pitch ramp: 55Hz → 110Hz during sweep
    const pitch = 55 + this.waveProgress * 55;
    this.callbacks.onDronePitch(pitch);

    // Wave complete
    if (this.waveProgress >= 1) {
      this.isActive = false;
      this.waveTimer = 0;
      // cleanup wall
      for (const p of this.wallParticles) p.dispose();
      this.wallParticles = [];
      this.callbacks.onWavePass();
    }
  }

  // ─── PUBLIC ─────────────────────────────────────────────────────────────────

  isWaveActive(): boolean { return this.isActive; }
  getWaveProgress(): number { return this.waveProgress; }
}
