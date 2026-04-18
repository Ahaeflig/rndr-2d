import * as readline from "node:readline";

import {
  ANSI_RESET,
  enterAltScreen,
  hideTerminalCursor,
  leaveAltScreen,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  rotateHexFacing,
  showTerminalCursor,
  summarizeSurface,
  summarizeSurfaceDiff,
  type Surface,
  type SurfaceDiffStats,
  type SurfaceStats
} from "../src/index.js";
import {
  buildZooFrame,
  clampSelectorToPage,
  createInitialZooState,
  getPageBoardForState,
  type ZooState
} from "./zoo-scene.js";

interface ZooOptions {
  altScreen: boolean;
  fps: number;
}

function printHelp() {
  process.stdout.write(`rndr-2d feature zoo

Usage:
  pnpm demo:zoo
  pnpm demo:zoo -- --fps 20
  pnpm demo:zoo -- --no-alt

Runtime controls:
  1/2/3 or Tab  switch pages
  Arrows/HJKL   move selector
  Enter         move ship to selector in play page
  Q/E           rotate ship through 6 facings
  Space         toggle autoplay
  P/T/S         toggle pulse, trail, stars
  [ / ]         hex scale in hex lab
  B             toggle usable hex row spans
  C             cycle palette
  D             toggle debug footer
  R             reset state
  ?             toggle help
  Esc           exit
`);
}

function parseArgs(argv: readonly string[]): ZooOptions | null {
  const options: ZooOptions = {
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cyclePage(state: ZooState) {
  const pages: ZooState["page"][] = ["play", "hex", "style"];
  const index = pages.indexOf(state.page);
  state.page = pages[(index + 1) % pages.length] ?? "play";
  state.selector = clampSelectorToPage(state, state.selector);
}

function applyMove(state: ZooState, delta: { q: number; r: number }) {
  state.selector = clampSelectorToPage(state, {
    q: state.selector.q + delta.q,
    r: state.selector.r + delta.r
  });
}

function onKeypress(state: ZooState, key: readline.Key) {
  if (key.name === "escape") {
    return "exit";
  }

  if (key.name === "tab") {
    cyclePage(state);
    return;
  }

  switch (key.sequence) {
    case "1":
      state.page = "play";
      state.selector = clampSelectorToPage(state, state.selector);
      return;
    case "2":
      state.page = "hex";
      state.selector = clampSelectorToPage(state, state.selector);
      return;
    case "3":
      state.page = "style";
      state.selector = clampSelectorToPage(state, state.selector);
      return;
    case "?":
      state.showHelp = !state.showHelp;
      return;
    case " ":
      state.autoplay = !state.autoplay;
      return;
    case "q":
      state.playerFacing = rotateHexFacing(state.playerFacing, -1);
      state.autoplay = false;
      return;
    case "e":
      state.playerFacing = rotateHexFacing(state.playerFacing, 1);
      state.autoplay = false;
      return;
    case "p":
      state.showPulse = !state.showPulse;
      return;
    case "t":
      state.showTrail = !state.showTrail;
      return;
    case "s":
      state.showStars = !state.showStars;
      return;
    case "b":
      state.showContentBoxes = !state.showContentBoxes;
      return;
    case "c":
      state.paletteIndex = (((state.paletteIndex + 1) % 3) as 0 | 1 | 2);
      return;
    case "d":
      state.showDebug = !state.showDebug;
      return;
    case "r": {
      const reset = createInitialZooState();
      Object.assign(state, reset);
      return;
    }
    case "[":
      state.scaleIndex = (((state.scaleIndex + 2) % 3) as 0 | 1 | 2);
      state.selector = clampSelectorToPage(state, state.selector);
      return;
    case "]":
      state.scaleIndex = (((state.scaleIndex + 1) % 3) as 0 | 1 | 2);
      state.selector = clampSelectorToPage(state, state.selector);
      return;
    case "k":
      applyMove(state, { q: 0, r: -1 });
      return;
    case "h":
      applyMove(state, { q: -1, r: 0 });
      return;
    case "j":
      applyMove(state, { q: 0, r: 1 });
      return;
    case "l":
      applyMove(state, { q: 1, r: 0 });
      return;
    default:
      break;
  }

  if (key.name === "up") {
    applyMove(state, { q: 0, r: -1 });
    return;
  }

  if (key.name === "down") {
    applyMove(state, { q: 0, r: 1 });
    return;
  }

  if (key.name === "left") {
    applyMove(state, { q: -1, r: 0 });
    return;
  }

  if (key.name === "right") {
    applyMove(state, { q: 1, r: 0 });
    return;
  }

  if (key.name === "return" && state.page === "play") {
    state.playerCoord = { ...clampSelectorToPage({ ...state, page: "play" }, state.selector) };
    state.autoplay = false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("demo:zoo requires a TTY.");
  }

  const state = createInitialZooState();
  const frameIntervalMs = 1000 / options.fps;
  const startedAt = Date.now();
  let previousFrame: Surface | null = null;
  let previousStats: SurfaceStats | null = null;
  let previousDiff: SurfaceDiffStats | null = null;
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
    const now = Date.now();
    const elapsedMs = now - startedAt;
    const board = getPageBoardForState(state);
    state.selector = clampSelectorToPage(state, state.selector);
    state.playerCoord = {
      q: clamp(state.playerCoord.q, 0, Math.max(0, board.cols - 1)),
      r: clamp(state.playerCoord.r, 0, Math.max(0, board.rows - 1))
    };

    const frame = buildZooFrame({
      state,
      elapsedMs,
      frameNumber,
      fps: options.fps,
      previousStats,
      previousDiff,
      terminalColumns: process.stdout.columns ?? 0,
      terminalRows: process.stdout.rows ?? 0
    });

    const output = previousFrame
      ? renderSurfaceDiffAnsi(previousFrame, frame, { resetAtEnd: true })
      : renderSurfaceAnsi(frame, { resetAtEnd: true });

    process.stdout.write(output);

    previousDiff = summarizeSurfaceDiff(previousFrame, frame);
    previousStats = summarizeSurface(frame);
    previousFrame = frame;
    frameNumber += 1;

    const nextDueAt = startedAt + frameNumber * frameIntervalMs;
    const waitMs = Math.max(0, nextDueAt - Date.now());
    await sleep(waitMs);
  }

  cleanup();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

await main();
