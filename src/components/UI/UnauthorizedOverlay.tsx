"use client";

import { useEffect, useRef } from "react";
import styles from "./UnauthorizedOverlay.module.css";

export default function UnauthorizedOverlay() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create ambient drone
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const drone = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(55, ctx.currentTime); // Low A
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.5);

    drone.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    drone.start();

    // Glitch LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);
    lfo.start();

    return () => {
      drone.stop();
      lfo.stop();
      ctx.close();
    };
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.scanlines} />
      <div className={styles.content}>
        <div className={styles.glitch} data-text="UNAUTHORIZED">UNAUTHORIZED</div>
        <div className={styles.sub}>DEVICE NOT CLEARED FOR ACCESS</div>
        <div className={styles.code}>ERR::0x4E45544B</div>
        <div className={styles.terminal}>
          <span className={styles.prompt}>root@arasaka:~$</span>
          <span className={styles.blink}>_</span>
        </div>
      </div>
    </div>
  );
}
