"use client";

import styles from "./Header.module.css";

interface HeaderProps {
  ready: boolean;
}

export default function Header({ ready }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.logoBracket}>[</span>
        <span className={styles.logoText}>ARASAKA-NET</span>
        <span className={styles.logoBracket}>]</span>
      </div>
      <div className={styles.status}>
        <span
          className={`${styles.statusDot} ${ready ? styles.dotGreen : styles.dotAmber}`}
        />
        <span className={styles.statusText}>
          {ready ? "SYSTEMS NOMINAL" : "INITIALIZING"}
        </span>
      </div>
    </header>
  );
}
