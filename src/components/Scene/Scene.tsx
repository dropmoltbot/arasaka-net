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
  MeshBuilder,
  StandardMaterial,
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import { CityGrid } from "./CityGrid";
import { COLORS, SCENE, SHADER } from "@/lib/constants";

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
}

export default function BabylonScene({
  onNodeClick,
  onCameraZChange,
  onReady,
}: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<UniversalCamera | null>(null);
  const cityGridRef = useRef<CityGrid | null>(null);
  const targetZRef = useRef(0);
  const currentZRef = useRef(0);
  const isReadyRef = useRef(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode; lfo: OscillatorNode; drone: OscillatorNode } | null>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    targetZRef.current += e.deltaY * SCENE.scrollSensitivity;
  }, []);

  const handleGlitchTrigger = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    (scene as any)._glitchState = { active: true, startTime: Date.now() };
  }, []);

  const handleClick = useCallback(
    (meshName: string) => {
      if (!isReadyRef.current) return;
      const nodeData = cityGridRef.current?.getNodeData(meshName);
      if (nodeData) {
        onNodeClick(nodeData);
      }
    },
    [onNodeClick]
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    scene.clearColor = new Color4(
      0.02,
      0.02,
      0.03,
      1
    ) as unknown as Color4;
    sceneRef.current = scene;

    // Camera — locked to Z-axis dolly only
    const camera = new UniversalCamera(
      "camera",
      new Vector3(0, 2, 20),
      scene
    );
    camera.setTarget(new Vector3(0, 2, 0));
    camera.minZ = 0.1;
    camera.maxZ = 500;
    // Disable all default camera controls
    camera.inputs.clear();
    cameraRef.current = camera;

    // Lighting
    const hemi = new HemisphericLight(
      "hemi",
      new Vector3(0, 1, 0),
      scene
    );
    hemi.intensity = 0.15;
    hemi.diffuse = new Color3(0.1, 0.1, 0.15) as unknown as import("@babylonjs/core").Color3;
    hemi.groundColor = new Color3(0.02, 0.02, 0.05) as unknown as import("@babylonjs/core").Color3;

    // Glow layer
    const glow = new GlowLayer("glow", scene);
    glow.intensity = SCENE.glowIntensity;
    glow.blurKernelSize = SCENE.glowKernel;

    // Post-processing pipeline
    const pipeline = new DefaultRenderingPipeline(
      "pipeline",
      true,
      scene,
      [camera]
    );
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.3;
    pipeline.bloomWeight = 0.8;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // Chromatic aberration on the pipeline for glitch effect
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 0;
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 0;
    pipeline.grain.animated = true;

    // City Grid
    const cityGrid = new CityGrid(scene, glow, handleClick, handleGlitchTrigger);
    cityGridRef.current = cityGrid;

    // Wheel event
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    // Animation loop
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

      // Update grid
      cityGrid.update(currentZRef.current);

      // Handle glitch effect on hover
      const glitchState = (scene as any)._glitchState;
      if (glitchState?.active) {
        const elapsed = Date.now() - glitchState.startTime;
        if (elapsed < SHADER.glitchDuration) {
          const progress = elapsed / SHADER.glitchDuration;
          const intensity = Math.sin(progress * Math.PI) * SHADER.chromaticOffset;
          pipeline.chromaticAberrationEnabled = true;
          pipeline.chromaticAberration.aberrationAmount = intensity;
          pipeline.grainEnabled = true;
          pipeline.grain.intensity = 15 + Math.random() * 10;
        } else {
          pipeline.chromaticAberration.aberrationAmount = 0;
          pipeline.grain.intensity = 0;
          glitchState.active = false;
        }
      } else {
        pipeline.chromaticAberration.aberrationAmount = 0;
        pipeline.grain.intensity = 0;
      }
    });

    // Resize
    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    // Start render loop
    engine.runRenderLoop(() => scene.render());

    isReadyRef.current = true;
    setTimeout(() => onReady(), 100);

    // Ambient sound — low cyberpunk drone
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
        audioRef.current = { ctx, gain: masterGain, lfo, drone };
      } catch {
        // Audio blocked — silently skip
      }
    };

    canvas.addEventListener("pointerdown", startAudio, { once: true });

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
  }, [handleWheel, handleClick, onNodeClick, onCameraZChange, onReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        outline: "none",
      }}
    />
  );
}
