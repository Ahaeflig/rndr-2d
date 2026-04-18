import {
  ANSI_RESET,
  enterAltScreen,
  hideTerminalCursor,
  leaveAltScreen,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  showTerminalCursor,
  summarizeSurface,
  summarizeSurfaceDiff,
  type Surface,
  type SurfaceDiffStats,
  type SurfaceStats
} from "../src/index.js";
import { buildLiveDemoFrame } from "./live-scene.js";

interface LiveDemoOptions {
  altScreen: boolean;
  fps: number;
  loop: boolean;
  seconds: number;
}

function printHelp() {
  process.stdout.write(`rndr-2d live demo

Usage:
  pnpm demo:live
  pnpm demo:live -- --seconds 12
  pnpm demo:live -- --fps 24 --loop
  pnpm demo:live -- --no-alt

Flags:
  --seconds <n>  run for n seconds before exiting, default 15
  --fps <n>      target frames per second, default 18
  --loop         run until interrupted
  --no-alt       do not enter alt screen
  --help         show this message
`);
}

function parseArgs(argv: readonly string[]): LiveDemoOptions | null {
  const options: LiveDemoOptions = {
    altScreen: true,
    fps: 18,
    loop: false,
    seconds: 15
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

    if (arg === "--loop") {
      options.loop = true;
      continue;
    }

    if (arg === "--no-alt") {
      options.altScreen = false;
      continue;
    }

    if (arg === "--seconds") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--seconds requires a number.");
      }

      options.seconds = Number(raw);
      index += 1;
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

  if (!Number.isFinite(options.seconds) || options.seconds <= 0) {
    throw new Error("--seconds must be a positive number.");
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

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    return;
  }

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

    if (!options.loop && elapsedMs >= options.seconds * 1000) {
      break;
    }

    const frame = buildLiveDemoFrame({
      elapsedMs,
      frameNumber,
      fps: options.fps,
      previousStats,
      previousDiff
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

  if (!options.altScreen) {
    process.stdout.write("\n");
  }
}

await main();
