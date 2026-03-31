'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  KeyboardEvent,
} from 'react';
import styles from './Terminal.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutputLine {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'system' | 'plain';
}

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
  onHackSuccess?: (nodeId: string) => void;
  onProbeStart?: () => void;
}

// ─── Fake file system ─────────────────────────────────────────────────────────

const FILES: Record<string, string> = {
  '/logs/access_2026.log': `[2026-03-31 00:14:22] UNAUTHORIZED ACCESS ATTEMPT
[2026-03-31 00:14:23] IP: 192.168.1.254 → BLOCKED
[2026-03-31 00:14:24] USER: root | ATTEMPT: 47 | STATUS: FAILED
[2026-03-31 00:14:25] SECURITY PROTOCOL: ICE-BRAKEN
[2026-03-31 00:14:26] YOU SHOULDN'T BE HERE...
[2026-03-31 00:14:27] ARASAKA NET DETECTION: ACTIVE
[2026-03-31 00:14:28] TRACING ROUTE...`,

  '/corp/employee_of_month.txt': `
   ██████╗ ██████╗ ███╗   ██╗███████╗ ██████╗ ███╗   ██╗
  ██╔════╝██╔═══██╗████╗  ██║██╔════╝██╔═══██╗████╗  ██║
  ██║     ██║   ██║██╔██╗ ██║███████╗██║   ██║██╔██╗ ██║
  ██║     ██║   ██║██║╚██╗██║╚════██║██║   ██║██║╚██╗██║
  ╚██████╗╚██████╔╝██║ ╚████║███████║╚██████╔╝██║ ╚████║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝

  ▓▓▓ EMPLOYEE OF THE MONTH ▓▓▓

  NAME: ███████████
  DEPT: CORPORATE SECURITY
  AWARD: EXTRA 15 MINUTES SCREEN TIME

  "Working at Arasaka is like being a hamster
   in a wheel filled with corpo BS. But hey,
   at least the dental plan covers implants!"

  — Anonymous Exit Interview #4471`,

  '/system/ice_status.cfg': `# ═══════════════════════════════════════════════
#   ARASAKA ICE DEPLOYMENT SCHEDULE
#   CLASSIFICATION: EYES ONLY
# ═══════════════════════════════════════════════

ICE_TYPE=BLACKWALL_PRO
STATUS=ACTIVE
LAYERS=4
ENTROPY=MAX

[LAYER_1] NAME=FIREWALL_ALPHA
          PORTS=443,8080,8443
          BLOCK=ALL_UNAUTHORIZED

[LAYER_2] NAME=NEURAL_DECRYPTOR
          ALGO=QUANTUM_AES-512
          KEYS=ROTATING_72H

[LAYER_3] NAME=ICE_TURRET
          RESPONSE=TERMINATE
          TIMEOUT=30s

[LAYER_4] NAME=BLACKNET_TRACE
          TRACE=ACTIVE
          AUTOREPORT=HEAD_SECURITY

NEXT_MAINTENANCE=2026-04-15
BACKDOOR_ACCESS=MAINTAINED`,

  '/backup/decrypted_keys.b64': `# ─────────────────────────────────────────
#  DECRYPTED BACKUP KEYS — CONFIDENTIAL
#  Generated: 2026-03-15 02:47:00 UTC
# ─────────────────────────────────────────

U2FsdGVkX1+ZG9kbGV5ZW5jcnlwdGlvbl9rZXlfMThfZmFrZV9kYXRhXzIwMjY=
U2FsdGVkX1+QU5PVEhFUl9TRUNURVJFX0RFUl9QRVJTPWZhbm9tX2tleV9wcm90b2NvbF9nZW5lcmF0ZWRfZm9yX3Rlc3Rpbmc=
U2FsdGVkX1+REVGX0tFWV9DTEFSSUZJRURfR0VORVJBVEVEX0ZPUl9MT0NBVE9OVU1CRlJPTTIwMjZfTU9DS19QVUJMSUM=

# ── END OF BACKUP ──`,

  '/corp/mainframe_access.crd': `
  ╔══════════════════════════════════════════════════════╗
  ║        ARASAKA CORPORATE MAINFRAME ACCESS             ║
  ║              CRITICAL FINANCIAL DATA                  ║
  ╠══════════════════════════════════════════════════════╣
  ║                                                      ║
  ║  ACCOUNT: ████████████████                           ║
  ║  CARD #:  4532-XXXX-XXXX-9917                        ║
  ║  EXP:     12/2029                                    ║
  ║  CVV:     [REDACTED]                                 ║
  ║                                                      ║
  ║  SSN:     XXX-XX-XXXX                               ║
  ║  DOB:     XX/XX/1970                                 ║
  ║                                                      ║
  ║  ACCESS LEVEL: OMEGA-BLUE                            ║
  ║  CLEARANCE:  ██████████████████████                   ║
  ║                                                      ║
  ╚══════════════════════════════════════════════════════╝
  [!] WARNING: UNAUTHORIZED ACCESS IS A FEDERAL CRIME`,

  '/classified/orbital_weapon.nav': `
  ════════════════════════════════════════════════════════
  ║     ARASAKA ORBITAL WEAPONS SYSTEM                   ║
  ║          NAVIGATION COORDINATES FILE                  ║
  ║           CLASSIFICATION: TOP SECRET                  ║
  ════════════════════════════════════════════════════════

  SATELLITE:  SKYNET-7
  ORBIT:      GEOSTATIONARY @ 35786km
  ALTITUDE:   35786.0 km
  INCLINATION: 0.0°

  PRIMARY TARGET:
    LAT:  35.6762° N
    LON: 139.6503° E
    ALT:  0 m (SURFACE)

  SECONDARY TARGETS:
    > 51.5074° N, 0.1278° W   [LONDON-HQ]
    > 40.7128° N, 74.0060° W  [NYC-NODE]
    > 48.8566° N, 2.3522° E   [PARIS-RELay]

  FIRE AUTHORIZATION:  OMEGA-7 PROTOCOL
  COUNTDOWN TO PRIME:  14 DAYS, 06:22:11

  [!] DO NOT DISTRIBUTE — ARASAKA INTERNAL USE ONLY`,

  '/logs/hack_trace.log': `[HACK SEQUENCE INITIATED]
> Bypassing firewall layer 1... DONE
> Cracking neural encryptor... DONE
> Disabling ICE turrets... DONE
> Spoofing Blacknet trace... DONE

[ACCESS GRANTED] — 2026-03-31 04:17:29

Data exfiltration complete. 47.3 TB extracted.
Covering tracks... DONE
Exiting... DONE

> SESSION TERMINATED — ROOT ACCESS MAINTAINED`,
};

// ─── Sound synthesis

function playKeypress(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  } catch { /* blocked */ }
}

function playError(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* blocked */ }
}

function playSuccess(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.15);
    });
  } catch { /* blocked */ }
}

function playHackComplete(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const freqs = [220, 330, 440, 660, 880, 1320, 1760];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + i * 0.05 + 0.2);
    });
  } catch { /* blocked */ }
}

// ─── Typing animation helper ──────────────────────────────────────────────────

async function typeText(
  text: string,
  speed: number,
  onChar: (char: string) => void,
  signal?: AbortSignal
): Promise<void> {
  for (const char of text) {
    if (signal?.aborted) break;
    onChar(char);
    await new Promise((r) => setTimeout(r, speed));
  }
}

// ─── Fake node data generator ─────────────────────────────────────────────────

function generateNodeData(nodeId: string): NodeData {
  const sectors = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'OMEGA', 'ZETA', 'ETA', 'THETA'];
  const secLevels = ['LEVEL 0', 'LEVEL 1', 'LEVEL 2', 'LEVEL 3', 'RESTRICTED'];
  const statuses = ['NOMINAL', 'MONITORED', 'COMPROMISED', 'OFFLINE', 'ENCRYPTED'];
  const packets = ['DATA-PKT-A', 'DATA-PKT-B', 'DATA-PKT-C', 'DATA-PKT-D'];
  const seed = nodeId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    nodeId,
    sector: sectors[seed % sectors.length],
    security: secLevels[seed % secLevels.length],
    status: statuses[seed % statuses.length],
    uptime: `${(seed * 7) % 9999}h ${(seed * 13) % 60}m`,
    packet: packets[seed % packets.length],
    timestamp: new Date().toISOString(),
  };
}

// ─── Fake network nodes ───────────────────────────────────────────────────────

const FAKE_NODES = [
  { nodeId: 'ND-ALPHA-01', sector: 'ALPHA', security: 'LEVEL 2', status: 'NOMINAL', uptime: '4821h 14m', packet: 'DATA-PKT-A', distance: '12ms' },
  { nodeId: 'ND-BETA-07', sector: 'BETA', security: 'LEVEL 3', status: 'ENCRYPTED', uptime: '1204h 33m', packet: 'DATA-PKT-B', distance: '28ms' },
  { nodeId: 'ND-GAMMA-03', sector: 'GAMMA', security: 'LEVEL 1', status: 'MONITORED', uptime: '7203h 05m', packet: 'DATA-PKT-C', distance: '7ms' },
  { nodeId: 'ND-DELTA-12', sector: 'DELTA', security: 'RESTRICTED', status: 'COMPROMISED', uptime: '92h 48m', packet: 'DATA-PKT-D', distance: '45ms' },
  { nodeId: 'ND-OMEGA-05', sector: 'OMEGA', security: 'LEVEL 0', status: 'OFFLINE', uptime: '0h 00m', packet: 'DATA-PKT-A', distance: '--' },
  { nodeId: 'ND-ZETA-09', sector: 'ZETA', security: 'LEVEL 2', status: 'NOMINAL', uptime: '5501h 22m', packet: 'DATA-PKT-B', distance: '19ms' },
  { nodeId: 'ND-ETA-02', sector: 'ETA', security: 'LEVEL 3', status: 'ENCRYPTED', uptime: '3307h 11m', packet: 'DATA-PKT-C', distance: '33ms' },
  { nodeId: 'ND-THETA-08', sector: 'THETA', security: 'LEVEL 1', status: 'MONITORED', uptime: '8812h 59m', packet: 'DATA-PKT-D', distance: '5ms' },
];

// ─── Main component ───────────────────────────────────────────────────────────

let lineIdCounter = 0;
const nextId = () => ++lineIdCounter;

export default function Terminal({
  isOpen,
  nodeData,
  onClose,
  onHackSuccess,
  onProbeStart,
}: TerminalProps) {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sudoAttempts, setSudoAttempts] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [flashGreen, setFlashGreen] = useState(false);
  const [hackProgress, setHackProgress] = useState<number | null>(null);
  const [showCursor, setShowCursor] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typingQueueRef = useRef<Array<{ text: string; type: OutputLine['type'] }>>([]);
  const isProcessingRef = useRef(false);

  // Boot sequence on first open
  const hasBootedRef = useRef(false);

  // ── Audio context init ──────────────────────────────────────────────────────
  const getAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  // ── Focus input when opened ──────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // ── Escape / backtick toggle ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ── Boot sequence ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !hasBootedRef.current) {
      hasBootedRef.current = true;
      const bootLines = [
        { text: 'ARASAKA-NET v4.7.2 — TERMINAL SESSION ACTIVE', type: 'system' as const },
        { text: 'CONNECTION ESTABLISHED. ENCRYPTION: QUANTUM-AES-512', type: 'info' as const },
        { text: 'TYPE "help" FOR AVAILABLE COMMANDS', type: 'info' as const },
        { text: '', type: 'plain' as const },
      ];
      bootLines.forEach((l, i) => {
        setTimeout(() => {
          setLines((prev) => [...prev, { id: nextId(), text: l.text, type: l.type }]);
        }, i * 200);
      });
    }
  }, [isOpen]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines]);

  // ── Blinking cursor ──────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // ─── Queue-based typing output ─────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (isProcessingRef.current || typingQueueRef.current.length === 0) return;
    isProcessingRef.current = true;
    setIsTyping(true);

    while (typingQueueRef.current.length > 0) {
      const item = typingQueueRef.current.shift()!;
      const { text, type } = item;

      const lineId = nextId();
      let chars = '';
      const speed = text.length > 120 ? 5 : text.length > 60 ? 10 : 18;

      setLines((prev) => [...prev, { id: lineId, text: '', type }]);

      abortRef.current = new AbortController();
      try {
        await typeText(text, speed, (c) => {
          chars += c;
          setLines((prev) =>
            prev.map((l) => (l.id === lineId ? { ...l, text: chars } : l))
          );
        }, abortRef.current!.signal);
      } catch {
        // aborted
      }
    }

    setIsTyping(false);
    isProcessingRef.current = false;
  }, []);

  const queue = useCallback(
    (text: string, type: OutputLine['type'] = 'plain') => {
      typingQueueRef.current.push({ text, type });
      flushQueue();
    },
    [flushQueue]
  );

  // ─── Command processing ──────────────────────────────────────────────────────

  const processCommand = useCallback(
    async (raw: string) => {
      const cmd = raw.trim().toLowerCase();
      const ctx = getAudio();
      const parts = raw.trim().split(/\s+/);
      const baseCmd = parts[0]?.toLowerCase() ?? '';
      const args = parts.slice(1);

      // Add to history
      if (raw.trim()) {
        setHistory((prev) => {
          const next = [raw.trim(), ...prev].slice(0, 50);
          return next;
        });
        setHistoryIndex(-1);
      }

      // Echo command
      setLines((prev) => [
        ...prev,
        { id: nextId(), text: `> ${raw}`, type: 'info' },
      ]);

      // ── help ─────────────────────────────────────────────────────────────────
      if (baseCmd === 'help') {
        queue('AVAILABLE COMMANDS:', 'system');
        const cmds = [
          ['help', 'Show this help menu'],
          ['clear', 'Clear terminal output'],
          ['status', 'Show network status'],
          ['scan [nodeId]', 'Scan a specific node'],
          ['probe', 'Scan ALL visible nodes'],
          ['hack [nodeId]', 'Initiate hack sequence on node'],
          ['decrypt [file]', 'Decrypt a corporate file'],
          ['netstat', 'Show active connections'],
          ['history', 'Show command history'],
          ['sudo [cmd]', 'Execute with elevated privileges'],
          ['ls', 'List accessible files'],
          ['cat [file]', 'Show file contents'],
          ['ping [host]', 'Ping a host'],
          ['trace [ip]', 'Traceroute to IP'],
        ];
        for (const [name, desc] of cmds) {
          queue(`  ${name.padEnd(20)} ${desc}`, 'plain');
        }
        return;
      }

      // ── clear ────────────────────────────────────────────────────────────────
      if (baseCmd === 'clear') {
        setLines([]);
        return;
      }

      // ── status ──────────────────────────────────────────────────────────────
      if (baseCmd === 'status') {
        queue('╔══════════════════════════════════════╗', 'system');
        queue('║       ARASAKA-NET STATUS REPORT      ║', 'system');
        queue('╚══════════════════════════════════════╝', 'system');
        queue(`  TOTAL NODES   : ${FAKE_NODES.length + 47}`, 'info');
        queue(`  UPTIME        : 847 DAYS, 12H, 33M`, 'info');
        queue(`  THREAT LEVEL  : ELEVATED`, 'warning');
        queue(`  ACTIVE USERS  : 12,847`, 'info');
        queue(`  ENCRYPTION    : QUANTUM-AES-512`, 'info');
        queue(`  ICE ACTIVE    : 4 LAYERS`, 'warning');
        queue(`  LAST BREACH   : 2026-03-29 03:17 UTC`, 'warning');
        queue('', 'plain');
        return;
      }

      // ── scan [nodeId] ──────────────────────────────────────────────────────
      if (baseCmd === 'scan') {
        const targetId = args[0]?.toUpperCase();
        if (!targetId) {
          queue('USAGE: scan [nodeId]  e.g.  scan ND-ALPHA-01', 'error');
          return;
        }
        const node = FAKE_NODES.find(
          (n) => n.nodeId === targetId || n.nodeId.includes(targetId)
        );
        if (!node) {
          queue(`NODE "${targetId}" NOT FOUND IN CACHE`, 'error');
          return;
        }
        queue(`INITIATING SCAN ON NODE: ${node.nodeId}`, 'system');
        await new Promise((r) => setTimeout(r, 500));
        queue('SCANNING... ████████░░ 80%', 'info');
        await new Promise((r) => setTimeout(r, 600));
        queue('ANALYZING... ██████████ 100%', 'success');
        queue('', 'plain');
        const nd = generateNodeData(node.nodeId);
        queue(`  NODE ID    : ${nd.nodeId}`, 'info');
        queue(`  SECTOR     : ${nd.sector}`, 'info');
        queue(`  SECURITY   : ${nd.security}`, 'info');
        queue(`  STATUS     : ${nd.status}`, 'info');
        queue(`  UPTIME     : ${nd.uptime}`, 'info');
        queue(`  DATA PKT   : ${nd.packet}`, 'info');
        queue(`  TIMESTAMP  : ${nd.timestamp}`, 'info');
        queue('', 'plain');
        queue(`SCAN COMPLETE. NODE "${nd.nodeId}" LOGGED.`, 'success');
        return;
      }

      // ── probe ──────────────────────────────────────────────────────────────
      if (baseCmd === 'probe') {
        queue('INITIATING FULL NETWORK PROBE...', 'system');
        await new Promise((r) => setTimeout(r, 400));
        window.dispatchEvent(new CustomEvent('probe-started'));
        queue('SCANNING ALL VISIBLE NODES...', 'info');
        await new Promise((r) => setTimeout(r, 800));

        queue('', 'plain');
        queue('╔════════╦════════╦═════════╦══════════╦══════════╦══════════╗', 'system');
        queue('║ NODE ID ║ SECTOR ║ SEC     ║ STATUS   ║ UPTIME   ║ LATENCY  ║', 'system');
        queue('╠════════╬════════╬═════════╬══════════╬══════════╬══════════╣', 'system');
        for (const n of FAKE_NODES) {
          const row = `║ ${n.nodeId.padEnd(6)} ║ ${n.sector.padEnd(6)} ║ ${n.security.split(' ')[1]?.padEnd(7) ?? '?'} ║ ${n.status.padEnd(8)} ║ ${n.uptime.padEnd(8)} ║ ${n.distance.padEnd(8)} ║`;
          queue(row, 'plain');
        }
        queue('╚════════╩════════╩═════════╩══════════╩══════════╩══════════╝', 'system');
        queue(`PROBE COMPLETE. ${FAKE_NODES.length} NODES SCANNED.`, 'success');
        return;
      }

      // ── hack [nodeId] ──────────────────────────────────────────────────────
      if (baseCmd === 'hack') {
        const targetId = args[0]?.toUpperCase();
        if (!targetId) {
          queue('USAGE: hack [nodeId]  e.g.  hack ND-ALPHA-01', 'error');
          return;
        }
        const node = FAKE_NODES.find(
          (n) => n.nodeId === targetId || n.nodeId.includes(targetId)
        );

        queue(`INITIATING HACK SEQUENCE ON: ${targetId}`, 'warning');
        await new Promise((r) => setTimeout(r, 300));

        // Progress bar
        setHackProgress(0);
        for (let i = 0; i <= 100; i += 2) {
          await new Promise((r) => setTimeout(r, 60));
          setHackProgress(i);
        }
        setHackProgress(null);

        playHackComplete(ctx);

        queue('', 'plain');
        queue('╔═══════════════════════════════════════╗', 'success');
        queue('║         ▓▓▓ ACCESS GRANTED ▓▓▓          ║', 'success');
        queue('╚═══════════════════════════════════════╝', 'success');
        queue('', 'plain');
        queue('BYPASSING ICE LAYERS...', 'info');
        queue('> FIREWALL_ALPHA ......... BYPASSED', 'success');
        queue('> NEURAL_DECRYPTOR ...... CRACKED', 'success');
        queue('> ICE_TURRET ............. DISABLED', 'success');
        queue('> BLACKNET_TRACE ........ SPOOFED', 'success');
        queue('', 'plain');

        const dataDump = node
          ? generateNodeData(node.nodeId)
          : generateNodeData(targetId);

        queue('// ─── DATA DUMP ───────────────────────────────────────────', 'system');
        queue(`NODE: ${dataDump.nodeId}`, 'info');
        queue(`SECTOR: ${dataDump.sector} | SEC: ${dataDump.security}`, 'info');
        queue(`STATUS: ${dataDump.status} | PKT: ${dataDump.packet}`, 'info');
        queue(`UPTIME: ${dataDump.uptime} | TS: ${dataDump.timestamp}`, 'info');
        queue('// ────────────────────────────────────────────────────────', 'system');
        queue('', 'plain');

        // ASCII art
        queue('     ███╗   ██╗███████╗ ██████╗ ███╗   ██╗', 'success');
        queue('     ████╗  ██║██╔════╝██╔═══██╗████╗  ██║', 'success');
        queue('     ██╔██╗ ██║█████╗  ██║   ██║██╔██╗ ██║', 'success');
        queue('     ██║╚██╗██║██╔══╝  ██║   ██║██║╚██╗██║', 'success');
        queue('     ██║ ╚████║███████╗╚██████╔╝██║ ╚████║', 'success');
        queue('     ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝', 'success');
        queue('', 'plain');

        // Flash green
        setFlashGreen(true);
        setTimeout(() => setFlashGreen(false), 600);

        // Dispatch event to Scene
        window.dispatchEvent(
          new CustomEvent('node-hacked', { detail: { nodeId: targetId } })
        );
        onHackSuccess?.(targetId);
        return;
      }

      // ── decrypt [file] ────────────────────────────────────────────────────
      if (baseCmd === 'decrypt') {
        const file = args[0];
        if (!file) {
          queue('USAGE: decrypt [file]', 'error');
          return;
        }
        const fileKey = Object.keys(FILES).find(
          (k) => k.includes(file) || k.endsWith('/' + file)
        );
        if (!fileKey) {
          queue(`FILE "${file}" NOT FOUND`, 'error');
          queue('USE "ls" TO SEE ACCESSIBLE FILES', 'info');
          return;
        }
        queue(`DECRYPTING ${fileKey}...`, 'system');
        await new Promise((r) => setTimeout(r, 700));
        queue('DECRYPTION LAYER 1: QUANTUM-AES-512 ... REMOVED', 'info');
        await new Promise((r) => setTimeout(r, 500));
        queue('DECRYPTION LAYER 2: NEURAL-OVERLAY ... BYPASSED', 'info');
        await new Promise((r) => setTimeout(r, 400));
        queue('DECRYPTION LAYER 3: ICE-SHIELD ....... NEUTRALIZED', 'success');
        await new Promise((r) => setTimeout(r, 300));
        queue('', 'plain');
        playSuccess(ctx);

        const content = FILES[fileKey];
        for (const line of content.split('\n')) {
          queue(line, 'plain');
        }
        return;
      }

      // ── netstat ────────────────────────────────────────────────────────────
      if (baseCmd === 'netstat') {
        queue('ACTIVE CONNECTIONS:', 'system');
        const conns = [
          ['TCP', '192.168.1.1:443', 'ESTABLISHED', 'QUANTUM-AES'],
          ['TCP', '10.0.0.254:8080', 'LISTENING', 'NEURAL-DEC'],
          ['UDP', '172.16.0.1:5353', 'OPEN', 'BASIC'],
          ['TCP', '192.168.1.100:22', 'ESTABLISHED', 'SSH-ENC'],
          ['TCP', '10.0.0.1:4444', 'SYN_SENT', '?????'],
          ['TCP', '127.0.0.1:1337', 'ESTABLISHED', 'LOOPBACK'],
        ];
        queue('', 'plain');
        queue('  PROTO    LOCAL ADDR         STATE         CIPHER', 'system');
        queue('  ────    ─────────────      ─────         ─────', 'system');
        for (const [proto, addr, state, cipher] of conns) {
          queue(`  ${proto.padEnd(7)} ${addr.padEnd(18)} ${state.padEnd(14)} ${cipher}`, 'plain');
        }
        queue('', 'plain');
        queue('TOTAL: 6 CONNECTIONS (1 SUSPICIOUS)', 'warning');
        return;
      }

      // ── history ────────────────────────────────────────────────────────────
      if (baseCmd === 'history') {
        if (history.length === 0) {
          queue('NO COMMAND HISTORY', 'info');
          return;
        }
        queue(`HISTORY (${history.length} ENTRIES):`, 'system');
        history.forEach((h, i) => {
          queue(`  ${String(i + 1).padStart(3)}  ${h}`, 'plain');
        });
        return;
      }

      // ── sudo [cmd] ─────────────────────────────────────────────────────────
      if (baseCmd === 'sudo') {
        const attempts = sudoAttempts + 1;
        setSudoAttempts(attempts);

        if (attempts <= 3) {
          playError(ctx);
          setShaking(true);
          setTimeout(() => setShaking(false), 500);

          const glitchText = '▓▓▓ ACCESS DENIED ▓▓▓'.split('').sort(() => Math.random() - 0.5).join('');
          queue(glitchText, 'error');
          queue(`AUTHORIZATION REQUIRED. ATTEMPT ${attempts}/3 FAILED.`, 'error');
          if (attempts < 3) {
            queue('RETRYING...', 'warning');
          } else {
            queue('MAX ATTEMPTS REACHED. LOCKOUT WARNING.', 'error');
          }
        } else {
          playSuccess(ctx);
          queue('', 'plain');
          queue('╔════════════════════════════════════════╗', 'success');
          queue('║      ▓▓▓ ROOT ACCESS GRANTED ▓▓▓        ║', 'success');
          queue('╚════════════════════════════════════════╝', 'success');
          queue('', 'plain');
          queue('USER: root | UID: 0 | GID: 0', 'info');
          queue('CLEARANCE: OMEGA-BLUE', 'success');
          queue('SECURITY BYPASS: ACTIVE', 'success');
          queue('YOU NOW HAVE FULL SYSTEM ACCESS', 'warning');
          queue('', 'plain');
          // Reset attempts after successful auth
          setSudoAttempts(0);
        }
        return;
      }

      // ── ls ─────────────────────────────────────────────────────────────────
      if (baseCmd === 'ls') {
        queue('ACCESSIBLE FILES:', 'system');
        for (const f of Object.keys(FILES)) {
          queue(`  ${f}`, 'info');
        }
        queue('', 'plain');
        return;
      }

      // ── cat [file] ─────────────────────────────────────────────────────────
      if (baseCmd === 'cat') {
        const file = args[0];
        if (!file) {
          queue('USAGE: cat [file]', 'error');
          return;
        }
        const fileKey = Object.keys(FILES).find(
          (k) => k.includes(file) || k.endsWith('/' + file)
        );
        if (!fileKey) {
          queue(`FILE "${file}" NOT FOUND`, 'error');
          return;
        }
        queue(`READING ${fileKey}...`, 'info');
        await new Promise((r) => setTimeout(r, 300));
        const content = FILES[fileKey];
        for (const line of content.split('\n')) {
          queue(line, 'plain');
        }
        return;
      }

      // ── ping [host] ────────────────────────────────────────────────────────
      if (baseCmd === 'ping') {
        const host = args[0] || 'localhost';
        queue(`PING ${host} (${Array(3).fill(Math.floor(Math.random() * 200) + 1).join('.')})`, 'system');
        await new Promise((r) => setTimeout(r, 200));
        for (let i = 0; i < 4; i++) {
          const ms = Math.floor(Math.random() * 80) + 5;
          const bar = '█'.repeat(Math.floor(ms / 5)) + '░'.repeat(16 - Math.floor(ms / 5));
          queue(`${host} (${ms}ms) ${bar}`, i < 2 ? 'plain' : i === 2 ? 'warning' : 'success');
          await new Promise((r) => setTimeout(r, 300));
        }
        queue('', 'plain');
        queue(`--- ${host} ping statistics ---`, 'info');
        queue(`4 packets transmitted, 4 received, 0% packet loss`, 'success');
        return;
      }

      // ── trace [ip] ─────────────────────────────────────────────────────────
      if (baseCmd === 'trace') {
        const ip = args[0] || '192.168.1.1';
        queue(`TRACEROUTE TO ${ip}:`, 'system');
        const hops = [
          [' 1', '192.168.0.1', '1.2ms', 'AS_LOCAL'],
          [' 2', '10.0.0.254', '4.7ms', 'AS_TRANSIT'],
          [' 3', '172.16.0.1', '8.3ms', 'AS_CORP'],
          [' 4', '100.64.0.1', '12.1ms', 'AS_SHARED'],
          [' 5', '*', '*', 'REQUEST_TIMEOUT'],
          [' 6', `${ip.split('.').slice(0, 3).join('.')}.254`, '23.8ms', 'AS_DEST'],
          [' 7', ip, '28.4ms', 'DEST_REACHED'],
        ];
        for (const [num, addr, ms, info] of hops) {
          await new Promise((r) => setTimeout(r, 350));
          const line = addr === '*'
            ? `${num}  * * * REQUEST_TIMEOUT *`
            : `${num}  ${addr.padEnd(15)} ${ms.padEnd(7)} ${info}`;
          queue(line, addr === '*' ? 'warning' : 'success');
        }
        queue('', 'plain');
        queue(`TRACE COMPLETE. 7 HOPS. TOTAL: ${28 + Math.floor(Math.random() * 20)}ms`, 'success');
        return;
      }

      // ── unknown ─────────────────────────────────────────────────────────────
      if (baseCmd === '') {
        return;
      }

      playError(ctx);
      queue(`UNKNOWN COMMAND: "${baseCmd}". TYPE "help" FOR AVAILABLE COMMANDS.`, 'error');
    },
    [getAudio, history, queue, onProbeStart, onHackSuccess, sudoAttempts]
  );

  // ─── Input key handlers ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const ctx = getAudio();
      playKeypress(ctx);

      if (e.key === 'Enter' && !isTyping && input.trim()) {
        const val = input;
        setInput('');
        processCommand(val);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Tab cycles — just refocus input for simplicity (focus trap)
        inputRef.current?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHistoryIndex((prev) => {
          const next = Math.min(prev + 1, history.length - 1);
          if (next >= 0 && history[next] !== undefined) {
            setInput(history[next]);
          }
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHistoryIndex((prev) => {
          const next = Math.max(prev - 1, -1);
          if (next === -1) {
            setInput('');
          } else if (history[next] !== undefined) {
            setInput(history[next]);
          }
          return next;
        });
      }
    },
    [input, isTyping, history, processCommand, getAudio]
  );

  // ─── Focus trap ─────────────────────────────────────────────────────────────

  const handleTab = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      // Tab cycles — just refocus input for simplicity
      inputRef.current?.focus();
    },
    []
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className={`
        ${styles.overlay}
        ${isOpen ? styles.open : ''}
        ${shaking ? styles.shake : ''}
        ${flashGreen ? styles.flashGreen : ''}
      `}
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
          {lines.map((line) => (
            <div key={line.id} className={styles.line}>
              <span className={`${styles.text} ${styles[line.type]}`}>
                {line.text}
              </span>
            </div>
          ))}

          {hackProgress !== null && (
            <div className={styles.line}>
              <span className={styles.text}>
                HACKING... [{( '\u2588'.repeat(Math.floor(hackProgress / 5)) + '\u2591'.repeat(20 - Math.floor(hackProgress / 5))) }] {hackProgress}%
              </span>
            </div>
          )}

          {isOpen && (
            <div className={styles.inputRow}>
              <span className={styles.promptSymbol}>&gt;</span>
              <input
                ref={inputRef}
                type="text"
                className={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={isTyping}
              />
              <span className={`${styles.cursorBlock} ${showCursor ? styles.cursorVisible : ''}`}>
                █
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
