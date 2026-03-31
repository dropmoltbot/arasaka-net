"use client";

import { useMemo } from "react";
import { formatCoord } from "@/lib/utils";
import styles from "./CoordinatesHUD.module.css";

interface CoordinatesHUDProps {
  cameraZ: number;
}

export default function CoordinatesHUD({ cameraZ }: CoordinatesHUDProps) {
  const coords = useMemo(
    () => ({
      x: formatCoord(0, 1),
      y: formatCoord(2, 1),
      z: formatCoord(cameraZ, 1),
    }),
    [cameraZ]
  );

  return (
    <div className={styles.hud}>
      <span className={styles.label}>POS</span>
      <span className={styles.coord}>
        {coords.x}
        <span className={styles.sep}> / </span>
        {coords.y}
        <span className={styles.sep}> / </span>
        <span className={styles.zCoord}>{coords.z}</span>
      </span>
    </div>
  );
}
