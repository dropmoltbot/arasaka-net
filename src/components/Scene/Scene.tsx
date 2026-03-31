"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  Color3,
  Color4,
  GlowLayer,
  HemisphericLight,
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import { CityGrid } from "./CityGrid";
import { COLORS, SCENE } from "@/lib/constants";

interface SceneProps {
  onNodeClick: (data: {
    nodeId: string;
    sector: string;
    security: string;
    status: string;
    uptime: string;
    packet: string;
    timestamp: string;
  }) => void;
  onCameraZChange: (z: number) => void;
  onReady: () => void;
  onWaveStart?: () => void;
  onWavePass?: () => void;
}

export default function BabylonScene({
  onNodeClick,
  onCameraZChange,
  onReady,
  onWaveStart,
  onWavePass,
}: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<UniversalCamera | null>(null);
  const cityGridRef = useRef<CityGrid | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);
  const targetZRef = useRef(0);
  const currentZRef = useRef(0);
  const isReadyRef = useRef(false);

  // Audio refs
  const audioRef = useRef<{
    ctx: AudioContext;
    drone: OscillatorNode;
    lfo: OscillatorNode;
    masterGain: GainNode;
    filter: BiquadFilterNode;
  } | null>(null);

  // ─── Wheel scroll ─────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    targetZRef.current += e.deltaY * SCENE.scrollSensitivity;
  }, []);

  // ─── Hover ─────────────────────────────────────────────────────────────────

  const handleHover = useCallback(() => {
    // Triggered by CityGrid on node hover — for future use
  }, []);

  // ─── Wave callbacks ──────────────────────────────────────────────────────────

  const handleWaveStart = useCallback(() => {
    onWaveStart?.();
  }, [onWaveStart]);

  const handleWavePass = useCallback(() => {
    onWavePass?.();
  }, [onWavePass]);

  const handleDronePitch = useCallback((pitch: number) => {
    if (audioRef.current) {
      audioRef.current.drone.frequency.setTargetAtTime(pitch, audioRef.current.ctx.currentTime, 0.1);
    }
  }, []);

  const handleMicroGlitch = useCallback(() => {
    // subtle pipeline glitch handled by GlitchEffects internally
  }, []);

  const handleFullGlitch = useCallback(() => {
    // handled via GlitchEffects pipeline update
  }, []);

  // ─── Setup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.02, 0.03, 1) as unknown as Color4;
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new UniversalCamera("camera", new Vector3(0, 2, 20), scene);
    camera.setTarget(new Vector3(0, 2, 0));
    camera.minZ = 0.1;
    camera.maxZ = 500;
    camera.inputs.clear();
    cameraRef.current = camera;

    // ── Lighting ──────────────────────────────────────────────────────────────
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.15;
    hemi.diffuse = new Color3(0.1, 0.1, 0.15) as unknown as Color3;
    hemi.groundColor = new Color3(0.02, 0.02, 0.05) as unknown as Color3;

    // ── Glow layer ───────────────────────────────────────────────────────────
    const glow = new GlowLayer("glow", scene);
    glow.intensity = SCENE.glowIntensity;
    glow.blurKernelSize = SCENE.glowKernel;

    // ── Post-processing pipeline ─────────────────────────────────────────────
    const pipeline = new DefaultRenderingPipeline("pipeline", true, scene, [camera]);
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.3;
    pipeline.bloomWeight = 0.8;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 0;
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 0;
    pipeline.grain.animated = true;
    pipelineRef.current = pipeline;

    // ── City Grid (pipeline available before construction) ───────────────────
    const cityGrid = new CityGrid(scene, glow, {
      onNodeClick: (meshName) => {
        if (!isReadyRef.current) return;
        const data = cityGrid.getNodeData(meshName);
        if (data) onNodeClick(data);
      },
      onHover: handleHover,
      onWaveStart: handleWaveStart,
      onWavePass: handleWavePass,
      onMicroGlitch: handleMicroGlitch,
      onFullGlitch: handleFullGlitch,
      onDronePitch: handleDronePitch,
    });
    cityGridRef.current = cityGrid;

    // ── Audio ────────────────────────────────────────────────────────────────
    const startAudio = () => {
      try {
        const ctx = new AudioContext();
        const drone = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const masterGain = ctx.createGain();

        drone.type = "sawtooth";
        drone.frequency.value = 55;
        lfo.type = "sine";
        lfo.frequency.value = 0.15;
        lfoGain.gain.value = 8;
        filter.type = "lowpass";
        filter.frequency.value = 280;
        masterGain.gain.value = 0.04;

        lfo.connect(lfoGain);
        lfoGain.connect(drone.frequency);
        drone.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);

        drone.start();
        lfo.start();
        audioRef.current = { ctx, drone, lfo, masterGain, filter };
      } catch {
        // Audio blocked
      }
    };

    canvas.addEventListener("pointerdown", startAudio, { once: true });

    // ── Events ────────────────────────────────────────────────────────────────
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    // ── Render loop ───────────────────────────────────────────────────────────
    let lastTime = performance.now();
    scene.registerBeforeRender(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Smooth camera dolly
      const diff = targetZRef.current - currentZRef.current;
      const speed = Math.min(Math.abs(diff) * 5, SCENE.maxScrollSpeed);
      if (Math.abs(diff) > 0.01) {
        currentZRef.current += Math.sign(diff) * speed * dt;
        camera.position.z = currentZRef.current + 20;
        camera.target.z = currentZRef.current;
        onCameraZChange(currentZRef.current);
      }

      // Update grid (this handles packets, waves, glitches)
      cityGrid.update(currentZRef.current);
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    engine.runRenderLoop(() => scene.render());

    isReadyRef.current = true;
    setTimeout(() => onReady(), 100);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("pointerdown", startAudio);
      window.removeEventListener("resize", handleResize);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      if (audioRef.current) {
        try {
          audioRef.current.drone.stop();
          audioRef.current.lfo.stop();
          audioRef.current.ctx.close();
        } catch { /* already gone */ }
        audioRef.current = null;
      }
    };
  }, [
    handleWheel,
    handleHover,
    handleWaveStart,
    handleWavePass,
    handleMicroGlitch,
    handleFullGlitch,
    handleDronePitch,
    onNodeClick,
    onCameraZChange,
    onReady,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", outline: "none" }}
    />
  );
}
