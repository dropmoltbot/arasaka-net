"use client";

import { useEffect, useRef } from "react";
import styles from "./Terminal.module.css";

interface NodeData {
  nodeId: string;
  sector: string;
  security: string;
  status: string;
  uptime: string;
  packet: string;
  timestamp: string;
}

interface TerminalProps {
  isOpen: boolean;
  nodeData: NodeData | null;
  onClose: () => void;
}

export default function Terminal({ isOpen, nodeData, onClose }: TerminalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [isOpen, nodeData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!nodeData) return null;

  const lines = [
    { prompt: ">", text: "ACCESSING NODE DATABASE..." },
    { prompt: ">", text: "" },
    {
      prompt: ">",
      text: `NODE ID    : ${nodeData.nodeId}`,
    },
    {
      prompt: ">",
      text: `SECTOR     : ${nodeData.sector}`,
    },
    {
      prompt: ">",
      text: `SECURITY   : ${nodeData.security}`,
    },
    {
      prompt: ">",
      text: `STATUS     : ${nodeData.status}`,
    },
    {
      prompt: ">",
      text: `UPTIME     : ${nodeData.uptime}`,
    },
    {
      prompt: ">",
      text: `DATA PKT   : ${nodeData.packet}`,
    },
    {
      prompt: ">",
      text: `TIMESTAMP  : ${nodeData.timestamp}`,
    },
    { prompt: ">", text: "" },
    {
      prompt: ">",
      text: "CONNECTION ENCRYPTED. SESSION LOGGED.",
    },
  ];

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.open : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.window}>
        <div className={styles.titleBar}>
          <div className={styles.titleDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
          <span className={styles.titleText}>ARASAKA-NET TERMINAL</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content} ref={contentRef}>
          {lines.map((line, i) => (
            <div
              key={i}
              className={styles.line}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className={styles.prompt}>{line.prompt}</span>
              <span className={styles.text}>{line.text}</span>
            </div>
          ))}
          <div className={styles.cursor} />
        </div>
      </div>
    </div>
  );
}
