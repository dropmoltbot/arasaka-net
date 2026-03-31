"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/UI/Header";
import Terminal from "@/components/Terminal/Terminal";
import CoordinatesHUD from "@/components/UI/CoordinatesHUD";
import ScanlineOverlay from "@/components/UI/ScanlineOverlay";
import UnauthorizedOverlay from "@/components/UI/UnauthorizedOverlay";
import { useDeviceDetect } from "@/components/UI/useDeviceDetect";
import styles from "./page.module.css";

// Dynamic import for Babylon scene (client-only, no SSR)
const Scene = dynamic(() => import("@/components/Scene/Scene"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.loadingTerminal}>
        <span className={styles.loadingLine}>ARASAKA-NET TERMINAL v2.0</span>
        <span className={styles.loadingLine}>Connecting to mainframe...</span>
        <span className={styles.loadingLine}>BYPASS ACTIVE</span>
        <span className={styles.loadingCursor}>_</span>
      </div>
    </div>
  ),
});

interface NodeData {
  nodeId: string;
  sector: string;
  security: string;
  status: string;
  uptime: string;
  packet: string;
  timestamp: string;
}

export default function HomePage() {
  const [terminalOpen, setTerminalOpen] = useState(true); // Terminal open by default
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [cameraZ, setCameraZ] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const { isMobile } = useDeviceDetect();

  const handleNodeClick = useCallback((data: NodeData) => {
    setSelectedNode(data);
    setTerminalOpen(true);
  }, []);

  const handleCloseTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, []);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  // Scene event listeners for terminal actions
  const handleHackSuccess = useCallback(() => {
    // Terminal handles window dispatchEvent('node-hacked', ...)
    // Scene listens and triggers effects
  }, []);

  const handleProbeStart = useCallback(() => {
    // Terminal dispatches probe-started
  }, []);

  return (
    <main className={styles.main}>
      {/* Mobile: block access */}
      {isMobile && <UnauthorizedOverlay />}

      {/* 3D Canvas */}
      <div className={styles.canvasWrapper}>
        <Scene
          onNodeClick={handleNodeClick}
          onCameraZChange={setCameraZ}
          onReady={handleSceneReady}
        />
      </div>

      {/* UI Overlays */}
      <Header ready={sceneReady} />
      <CoordinatesHUD cameraZ={cameraZ} />
      <ScanlineOverlay />
      <Terminal
        isOpen={terminalOpen}
        nodeData={selectedNode}
        onClose={handleCloseTerminal}
        onHackSuccess={handleHackSuccess}
        onProbeStart={handleProbeStart}
      />

      {/* Scroll hint */}
      <div className={styles.scrollHint}>
        <span>SCROLL TO TRAVERSE</span>
      </div>
    </main>
  );
}
