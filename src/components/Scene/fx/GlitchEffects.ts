"use client";

import {
  Scene as BabylonScene,
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import { SHADER } from "@/lib/constants";

export interface GlitchCallbacks {
  onMicroGlitch: () => void;
  onFullGlitch: () => void;
}

export class GlitchEffects {
  private scene: BabylonScene;
  private pipeline: DefaultRenderingPipeline;
  private callbacks: GlitchCallbacks;

  // State
  private isHoverGlitch = false;
  private hoverGlitchNodeId: string | null = null;
  private activeGlitch: { startTime: number } | null = null;
  private microGlitchTimer = 0;
  private nextMicroGlitch = 10 + Math.random() * 10; // 10-20s

  constructor(
    scene: BabylonScene,
    pipeline: DefaultRenderingPipeline,
    callbacks: GlitchCallbacks
  ) {
    this.scene = scene;
    this.pipeline = pipeline;
    this.callbacks = callbacks;
  }

  // ─── FULL GLITCH (attack wave / burst) ────────────────────────────────────────

  triggerFullGlitch() {
    this.activeGlitch = { startTime: performance.now() };
    this.callbacks.onFullGlitch();
  }

  // ─── HOVER GLITCH ────────────────────────────────────────────────────────────

  startHoverGlitch(nodeId: string | null) {
    this.isHoverGlitch = true;
    this.hoverGlitchNodeId = nodeId;
  }

  stopHoverGlitch() {
    this.isHoverGlitch = false;
    this.hoverGlitchNodeId = null;
  }

  // ─── MICRO GLITCH ─────────────────────────────────────────────────────────────

  private triggerMicroGlitch() {
    this.activeGlitch = { startTime: performance.now() };
    this.callbacks.onMicroGlitch();
    this.nextMicroGlitch = 10 + Math.random() * 10;
  }

  // ─── UPDATE (called every frame) ─────────────────────────────────────────────

  update(dt: number, time: number) {
    // Micro-glitch timer
    this.microGlitchTimer += dt;
    if (this.microGlitchTimer >= this.nextMicroGlitch) {
      this.microGlitchTimer = 0;
      this.triggerMicroGlitch();
    }

    // Resolve active glitch
    if (this.activeGlitch) {
      const elapsed = performance.now() - this.activeGlitch.startTime;
      if (elapsed < SHADER.glitchDuration) {
        const progress = elapsed / SHADER.glitchDuration;
        const intensity = Math.sin(progress * Math.PI) * SHADER.chromaticOffset;

        this.pipeline.chromaticAberrationEnabled = true;
        this.pipeline.chromaticAberration.aberrationAmount = intensity;
        this.pipeline.grainEnabled = true;
        this.pipeline.grain.intensity = 15 + Math.random() * 10;
      } else {
        this.pipeline.chromaticAberration.aberrationAmount = 0;
        this.pipeline.grain.intensity = 0;
        this.activeGlitch = null;
      }
    } else {
      // Subtle hover glitch
      if (this.isHoverGlitch) {
        const wobble = Math.sin(time * 30) * 0.5;
        this.pipeline.chromaticAberrationEnabled = true;
        this.pipeline.chromaticAberration.aberrationAmount = 3 + wobble;
        this.pipeline.grainEnabled = true;
        this.pipeline.grain.intensity = 5 + Math.random() * 3;
      } else {
        // Quiet state — all off
        if (!this.activeGlitch) {
          this.pipeline.chromaticAberration.aberrationAmount = 0;
          this.pipeline.grain.intensity = 0;
        }
      }
    }
  }

  // ─── ATTACK WAVE GLITCH (sustained, called by AttackWave) ───────────────────

  startWaveGlitch() {
    this.activeGlitch = { startTime: performance.now() };
  }

  updateWaveGlitch(elapsed: number, totalDuration: number) {
    if (elapsed < totalDuration) {
      const progress = elapsed / totalDuration;
      // Glitch peaks at wave front, fades after
      const intensity = Math.sin(progress * Math.PI) * SHADER.chromaticOffset * 3;
      this.pipeline.chromaticAberrationEnabled = true;
      this.pipeline.chromaticAberration.aberrationAmount = intensity;
      this.pipeline.grainEnabled = true;
      this.pipeline.grain.intensity = 20 + Math.random() * 15;
    } else {
      this.pipeline.chromaticAberration.aberrationAmount = 0;
      this.pipeline.grain.intensity = 0;
    }
  }
}
