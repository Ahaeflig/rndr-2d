import * as readline from "node:readline";

import {
  ANSI_RESET,
  BrailleSurface,
  DenseLightSurface,
  Surface,
  addProjectedLightPlaneRing,
  blitProjectedBrailleBillboard,
  createCell,
  createPerspectiveProjection3D,
  drawProjectedLine,
  enterAltScreen,
  hideTerminalCursor,
  leaveAltScreen,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  rgbColor,
  showTerminalCursor,
  type Point3
} from "../src/index.js";

const FRAME_WIDTH = 84;
const FRAME_HEIGHT = 30;
const WORLD_NEAR_Y = 4;
const WORLD_FAR_Y = 17;

interface DepthDemoOptions {
  altScreen: boolean;
  fps: number;
}

interface DepthDemoState {
  assetY: number;
  cameraY: number;
  cameraHeight: number;
  fov: number;
}

interface BillboardItem {
  name: string;
  source: BrailleSurface;
  position: Point3;
  width: number;
  height: number;
}

function printHelp() {
  process.stdout.write(`rndr-2d projection depth test

Usage:
  pnpm demo:projection-depth
  pnpm demo:projection-depth -- --fps 24
  pnpm demo:projection-depth -- --no-alt

Runtime controls:
  W/S or J/K      move the braille asset backward/forward
  Up/Down         move the camera backward/forward
  [ / ]           lower/raise camera height
  - / =           narrow/widen perspective FOV
  R               reset
  Esc             exit
`);
}

function parseArgs(argv: readonly string[]): DepthDemoOptions | null {
  const options: DepthDemoOptions = {
    altScreen: true,
    fps: 18
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help") {
      printHelp();
      return null;
    }

    if (arg === "--no-alt") {
      options.altScreen = false;
      continue;
    }

    if (arg === "--fps") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--fps requires a number.");
      }

      options.fps = Number(raw);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.fps) || options.fps <= 0) {
    throw new Error("--fps must be a positive number.");
  }

  return options;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createInitialState(): DepthDemoState {
  return {
    assetY: 9,
    cameraY: -7,
    cameraHeight: 6,
    fov: 52
  };
}

function createCreatureSprite() {
  const sprite = new BrailleSurface(4, 5, {
    activationThreshold: 0.2
  });
  const body = { value: 1, style: { foreground: rgbColor(244, 205, 92), bold: true } };
  const shadow = { value: 1, style: { foreground: rgbColor(142, 96, 46) } };
  const eye = { value: 1, style: { foreground: rgbColor(255, 255, 245), bold: true } };
  const accent = { value: 1, style: { foreground: rgbColor(79, 220, 178), bold: true } };

  sprite.fillCircle({ x: 4, y: 11 }, 3.8, body);
  sprite.fillCircle({ x: 4, y: 7 }, 2.7, body);
  sprite.drawDotLine({ x: 1, y: 12 }, { x: 0, y: 17 }, shadow);
  sprite.drawDotLine({ x: 7, y: 12 }, { x: 7, y: 17 }, shadow);
  sprite.paintDot(3, 6, eye);
  sprite.paintDot(5, 6, eye);
  sprite.drawDotLine({ x: 3, y: 3 }, { x: 1, y: 0 }, accent);
  sprite.drawDotLine({ x: 5, y: 3 }, { x: 7, y: 0 }, accent);

  return sprite;
}

function createDepthMarkerSprite(color: ReturnType<typeof rgbColor>) {
  const marker = new BrailleSurface(3, 8, {
    activationThreshold: 0.2
  });
  const paint = { value: 1, style: { foreground: color, bold: true } };

  marker.drawDotLine({ x: 3, y: 0 }, { x: 3, y: 31 }, paint);
  marker.drawDotLine({ x: 0, y: 5 }, { x: 5, y: 5 }, paint);
  marker.drawDotLine({ x: 0, y: 26 }, { x: 5, y: 26 }, paint);
  marker.fillCircle({ x: 3, y: 15.5 }, 2.3, paint);

  return marker;
}

function labelAtProjectedPoint(frame: Surface, point: { x: number; y: number }, text: string) {
  const x = Math.round(point.x - text.length / 2);
  const y = Math.round(point.y);

  if (y < 1 || y >= frame.height - 1) {
    return;
  }

  frame.drawText({ x: clamp(x, 0, Math.max(0, frame.width - text.length)), y }, text, {
    foreground: rgbColor(186, 198, 220)
  });
}

function drawGround(
  terrain: BrailleSurface,
  glow: DenseLightSurface,
  projection: ReturnType<typeof createPerspectiveProjection3D>
) {
  const gridStyle = { value: 1, style: { foreground: rgbColor(51, 75, 93) } };
  const centerStyle = { value: 1, style: { foreground: rgbColor(96, 136, 152), bold: true } };

  for (let y = 0; y <= 22; y += 2) {
    drawProjectedLine(
      terrain,
      projection,
      { x: -7, y, z: 0 },
      { x: 7, y, z: 0 },
      y === WORLD_NEAR_Y || y === WORLD_FAR_Y ? centerStyle : gridStyle
    );
  }

  for (let x = -6; x <= 6; x += 2) {
    drawProjectedLine(
      terrain,
      projection,
      { x, y: 0, z: 0 },
      { x, y: 22, z: 0 },
      gridStyle
    );
  }

  addProjectedLightPlaneRing(glow, {
    projection,
    center: { x: 0, y: WORLD_NEAR_Y, z: 0 },
    radius: 1.15,
    color: { r: 255, g: 150, b: 76 },
    strength: 1.3,
    spread: 1.1,
    segments: 32
  });
  addProjectedLightPlaneRing(glow, {
    projection,
    center: { x: 0, y: WORLD_FAR_Y, z: 0 },
    radius: 1.15,
    color: { r: 73, g: 177, b: 255 },
    strength: 1.3,
    spread: 1.1,
    segments: 32
  });
}

function buildDepthDemoFrame(state: DepthDemoState) {
  const frame = new Surface(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    createCell(" ", {
      background: rgbColor(6, 10, 15)
    })
  );
  const projection = createPerspectiveProjection3D({
    position: { x: 0, y: state.cameraY, z: state.cameraHeight },
    target: { x: 0, y: state.cameraY + 14, z: 0 },
    viewportSize: { width: FRAME_WIDTH, height: FRAME_HEIGHT - 3 },
    screenCenter: { x: FRAME_WIDTH / 2, y: 15 },
    verticalFovDegrees: state.fov,
    near: 0.1
  });
  const terrain = new BrailleSurface(FRAME_WIDTH, FRAME_HEIGHT, {
    activationThreshold: 0.2
  });
  const glow = new DenseLightSurface(FRAME_WIDTH, FRAME_HEIGHT, {
    background: { r: 6, g: 10, b: 15 },
    backgroundGlow: true,
    backgroundGlowMinEnergy: 0.06,
    dither: true,
    ditherSeed: 41,
    minEnergy: 0.02,
    minDotDensity: 0.02,
    maxDotDensity: 0.68,
    brightnessBase: 0.2,
    brightnessPower: 0.4,
    brightnessScale: 0.9,
    colorScale: 1.2,
    activationThreshold: 0.2
  });
  const creature = createCreatureSprite();
  const nearMarker = createDepthMarkerSprite(rgbColor(255, 139, 82));
  const farMarker = createDepthMarkerSprite(rgbColor(70, 177, 255));
  const items: BillboardItem[] = [
    {
      name: "fixed front",
      source: nearMarker,
      position: { x: -2.9, y: WORLD_NEAR_Y, z: 0 },
      width: 0.8,
      height: 2.6
    },
    {
      name: "moving asset",
      source: creature,
      position: { x: 0, y: state.assetY, z: 0 },
      width: 1.4,
      height: 2.2
    },
    {
      name: "fixed back",
      source: farMarker,
      position: { x: 2.9, y: WORLD_FAR_Y, z: 0 },
      width: 0.8,
      height: 2.6
    }
  ];

  drawGround(terrain, glow, projection);
  frame.blit(glow, { x: 0, y: 0 }, { blendMode: "background" });
  frame.blit(terrain, { x: 0, y: 0 });

  for (const item of [...items].sort((a, b) => b.position.y - a.position.y)) {
    blitProjectedBrailleBillboard(terrain, {
      projection,
      source: item.source,
      position: item.position,
      width: item.width,
      height: item.height,
      anchor: "bottomCenter"
    });
  }

  frame.blit(terrain, { x: 0, y: 0 });

  for (const item of items) {
    const projected = projection.projectOrNull({ ...item.position, z: item.height + 0.2 });

    if (projected) {
      labelAtProjectedPoint(frame, projected.point, item.name);
    }
  }

  frame.drawText({ x: 2, y: 1 }, "projection depth test", {
    foreground: rgbColor(232, 241, 255),
    bold: true
  });
  frame.drawText(
    { x: 2, y: 2 },
    `asset y=${state.assetY.toFixed(1)}  camera y=${state.cameraY.toFixed(1)} z=${state.cameraHeight.toFixed(1)} fov=${state.fov.toFixed(0)}`,
    { foreground: rgbColor(145, 163, 184) }
  );
  frame.drawText({ x: 2, y: FRAME_HEIGHT - 2 }, "W/S asset depth  Up/Down camera depth  [/] height  -/= FOV  R reset  Esc exit", {
    foreground: rgbColor(118, 134, 154)
  });

  return frame;
}

function onKeypress(state: DepthDemoState, key: readline.Key) {
  if (key.name === "escape") {
    return "exit";
  }

  switch (key.sequence) {
    case "w":
    case "k":
      state.assetY = clamp(state.assetY + 0.4, 1.5, 21);
      return;
    case "s":
    case "j":
      state.assetY = clamp(state.assetY - 0.4, 1.5, 21);
      return;
    case "[":
      state.cameraHeight = clamp(state.cameraHeight - 0.3, 2.5, 12);
      return;
    case "]":
      state.cameraHeight = clamp(state.cameraHeight + 0.3, 2.5, 12);
      return;
    case "-":
      state.fov = clamp(state.fov - 2, 30, 90);
      return;
    case "=":
      state.fov = clamp(state.fov + 2, 30, 90);
      return;
    case "r": {
      Object.assign(state, createInitialState());
      return;
    }
    default:
      break;
  }

  if (key.name === "up") {
    state.cameraY = clamp(state.cameraY + 0.4, -12, 8);
    return;
  }

  if (key.name === "down") {
    state.cameraY = clamp(state.cameraY - 0.4, -12, 8);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("demo:projection-depth requires a TTY.");
  }

  const state = createInitialState();
  const frameIntervalMs = 1000 / options.fps;
  let previousFrame: Surface | null = null;
  let frameNumber = 0;
  let cleanedUp = false;
  let stopRequested = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    process.stdin.off("keypress", handleKeypress);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    const parts = [ANSI_RESET, showTerminalCursor()];

    if (options.altScreen) {
      parts.push(leaveAltScreen());
    }

    process.stdout.write(parts.join(""));
  };

  const stop = (exitCode = 0) => {
    stopRequested = true;
    cleanup();
    process.exit(exitCode);
  };

  const handleKeypress = (_str: string, key: readline.Key) => {
    const result = onKeypress(state, key);

    if (result === "exit") {
      stop(0);
    }
  };

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("keypress", handleKeypress);

  process.on("SIGINT", () => stop(130));
  process.on("SIGTERM", () => stop(143));
  process.on("uncaughtException", (error) => {
    cleanup();
    process.stderr.write(`${error.stack ?? String(error)}\n`);
    process.exit(1);
  });

  if (options.altScreen) {
    process.stdout.write(`${enterAltScreen()}${hideTerminalCursor()}`);
  }

  while (!stopRequested) {
    const frame = buildDepthDemoFrame(state);
    const output = previousFrame
      ? renderSurfaceDiffAnsi(previousFrame, frame, { resetAtEnd: true })
      : renderSurfaceAnsi(frame, { resetAtEnd: true });

    process.stdout.write(output);
    previousFrame = frame;
    frameNumber += 1;
    await sleep(Math.max(0, frameIntervalMs - (Date.now() % frameIntervalMs)));

    if (frameNumber > Number.MAX_SAFE_INTEGER - 1) {
      frameNumber = 0;
    }
  }

  cleanup();
}

await main();
