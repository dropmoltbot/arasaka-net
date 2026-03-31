# ARASAKA-NET — SPEC.md

> Arasaka City Grid — Interactive 3D WebGL Experience
> Version: 0.1.0 | Stack: Next.js 15 + Babylon.js + TypeScript

---

## 1. Concept & Vision

**Arasaka City Grid** is an interactive 3D visualization of a fictional corporate city-network — an infinite neon grid where data flows as glowing pulses along network nodes. The user scrolls through the grid, hovers over nodes to trigger glitch shaders, and clicks to reveal "node details" (a terminal-style overlay). It's not a game — it's a statement piece. Cyberpunk minimalism rendered in real-time WebGPU.

**Vibe:** Cold. Surgical. Ominous. Like walking through a megacorp's data center at 3 AM.

---

## 2. Design Language

### Aesthetic Direction
Neo-noir corporate dystopia. Think: Ghost in the Shell corporate interiors meets Bloomberg Terminal aesthetics. Dark backgrounds, phosphorescent accent lines, monospace data.

### Color Palette
```
--bg-primary:    #050508      (void black)
--bg-secondary:  #0a0a0f      (terminal dark)
--neon-cyan:     #00f5ff      (primary accent — data streams)
--neon-magenta:  #ff006e      (alert — node breach)
--neon-amber:    #ffbe0b      (warning — access denied)
--grid-line:     #1a1a2e      (subtle grid)
--text-primary:  #e0e0e0      (readable grey)
--text-muted:    #4a4a5a      (subdued)
--scanline:      rgba(0,245,255,0.03) (CRT overlay)
```

### Typography
- **Primary:** `JetBrains Mono` — monospace, technical, readable
- **Display:** `Orbitron` — geometric, futuristic, used sparingly for titles
- **Fallback:** `ui-monospace, monospace`

### Spatial System
- Grid-based layout with 8px base unit
- Full viewport canvas, overlaid UI elements
- Generous negative space — content floats in the void

### Motion Philosophy
- **Grid pulse:** Nodes emit a radial pulse every 3-5s (sin wave timing)
- **Hover glitch:** Chromatic aberration + noise displacement on hover (300ms ease-out)
- **Scroll traversal:** Smooth camera dolly along Z-axis, parallax depth on nodes
- **Click reveal:** Terminal window slides up with typewriter text effect

### Visual Assets
- Custom GLSL shaders (grid lines, scanlines, glitch)
- Babylon.js GlowLayer for neon bloom
- No external images — all procedural geometry

---

## 3. Layout & Structure

### Page Architecture
```
/ (root)
├── Full-viewport Babylon.js canvas (background layer)
├── Overlay UI (HTML — positioned absolute)
│   ├── Header: ARASAKA-NET logo + status indicator
│   ├── Terminal panel: node details (hidden → slide-up on click)
│   └── Footer: coordinates display + scroll hint
└── No traditional page sections — immersive only
```

### Responsive Strategy
- Desktop-first (1920x1080 target)
- Tablet: reduce node density, disable some post-processing
- Mobile: simplified 2D fallback (not 3D) — "unauthorized device" message

---

## 4. Features & Interactions

### Core Features

**F1: Infinite Procedural Grid**
- Grid of nodes extends along Z-axis (simulated infinite)
- Nodes placed at regular intervals with slight position jitter (±0.5 units)
- Lines connect nearest neighbors (procedural mesh lines)
- New nodes generated as camera approaches (spawn/despawn)

**F2: Neon Glow & Bloom**
- Babylon.js GlowLayer: intensity 1.2, blurKernelSize 32
- Each node has a PointLight (range 8, intensity 0.3)
- Emissive materials on node spheres

**F3: Scroll Traversal**
- Mouse wheel / trackpad scroll → camera dolly along Z-axis
- Smooth momentum with decay (lerp factor 0.08)
- Speed capped to prevent disorientation

**F4: Node Hover — Glitch Shader**
- Raycasting detects hover on node meshes
- On hover: chromatic aberration (RGB split 2-4px) + noise displacement
- Shader uniforms: `uGlitchIntensity` animated 0→1→0 over 400ms
- Node emissive color shifts to `--neon-magenta` on hover

**F5: Node Click — Terminal Overlay**
- Click triggers full-screen terminal panel (slide up from bottom)
- Content: node ID, coordinates, "security level", random "data packet" content
- Typewriter effect: chars revealed at 30ms intervals
- Close: ESC or click outside

**F6: Scanline Overlay**
- Full-screen HTML overlay with CSS `repeating-linear-gradient`
- Subtle animated vertical scroll (2px/second)
- `pointer-events: none` — purely decorative

**F7: Coordinates HUD**
- Bottom-left: live X/Y/Z camera position updating at 60fps
- Formatted: `POS 0000.00 / 0000.00 / -0000.00`

---

## 5. Component Inventory

### `<Scene />` (Babylon.js Canvas)
- **Default:** Renders grid, lights, camera
- **Loading:** Black screen with pulsing "INITIALIZING..." text
- **Error:** "RENDER SUBSYSTEM FAILURE" + retry button

### `<Header />`
- **Default:** Logo left, status dot right (green = nominal)
- **Loading:** Status dot amber pulsing

### `<Terminal />`
- **Hidden:** Off-screen (translateY: 100%)
- **Active:** Slides up, dark semi-transparent bg, monospace text
- **Typing:** Cursor blinks at end of current line

### `<CoordinatesHUD />`
- **Default:** Fixed bottom-left, monospace, low opacity (0.4)
- **Active:** Opacity 1.0 when user scrolling

### `<ScanlineOverlay />`
- **Always:** CSS-only, no state changes

---

## 6. Technical Approach

### Stack
```
Framework:  Next.js 15 (App Router, TypeScript)
3D Engine:  Babylon.js 7.x (@babylonjs/core)
Shaders:    Custom GLSL (inline shader store)
Styling:    CSS Modules + CSS Variables
Deployment: Vercel (SSR disabled for canvas route)
```

### Architecture
```
src/
├── app/
│   ├── layout.tsx         (root layout, fonts, metadata)
│   ├── page.tsx            (entry — composes Scene + UI)
│   └── globals.css         (CSS vars, reset, scanline)
├── components/
│   ├── Scene/
│   │   ├── Scene.tsx       (Babylon scene setup)
│   │   ├── CityGrid.ts     (procedural grid generation)
│   │   ├── GlitchShader.ts (custom shader definition)
│   │   └── scene.module.css
│   ├── Terminal/
│   │   ├── Terminal.tsx    (slide-up panel)
│   │   └── terminal.module.css
│   └── UI/
│       ├── Header.tsx
│       ├── CoordinatesHUD.tsx
│       └── ScanlineOverlay.tsx
└── lib/
    ├── constants.ts        (colors, grid params)
    └── utils.ts            (typewriter, lerp helpers)
```

### Key Implementation Details
- Babylon.js canvas uses `engine.useForceIronScheme` + `adaptToDeviceRatio`
- Grid nodes: `MeshBuilder.CreateSphere` instances pooled (max 200 active)
- Lines: `MeshBuilder.CreateLines` with vertex updates (not recreate)
- Glitch shader: registered via `Effect.ShadersStore["glitchFragmentShader"]`
- Camera: `UniversalCamera` locked to Z-axis dolly only (no rotation)
- Raycasting: `scene.pick()` on `pointermove`

### Performance Targets
- 60fps on desktop (1920x1080)
- <3s initial load (lazy load Babylon after JS)
- Node count: 150-200 simultaneous meshes
- Draw calls: <50 via mesh merging for static grid lines

---

## 7. Milestones

- [x] M1: Repo init + Next.js + Babylon.js setup ✅
- [ ] M2: Basic grid rendering (procedural nodes + lines)
- [ ] M3: GlowLayer + emissive materials
- [ ] M4: Camera dolly + scroll controls
- [ ] M5: Hover glitch shader + raycasting
- [ ] M6: Terminal overlay + typewriter
- [ ] M7: Scanline overlay + HUD
- [ ] M8: Deploy to Vercel + DNS/config
