"use client";

import styles from "./ScanlineOverlay.module.css";

export default function ScanlineOverlay() {
  return (
    <div
      className={styles.overlay}
      aria-hidden="true"
    />
  );
}
