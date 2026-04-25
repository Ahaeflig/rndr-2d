import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import * as readline from "node:readline";
import { promisify } from "node:util";

import {
  ANSI_RESET,
  BrailleSurface,
  Surface,
  createCell,
  enterAltScreen,
  hideTerminalCursor,
  leaveAltScreen,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  rgbColor,
  showTerminalCursor,
  type Surface as SurfaceFrame
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const DEFAULT_FRAMES_DIR =
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/frames";
const DEFAULT_VIDEO_PATH =
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/preview_on_light.mp4";
const MIN_COLS = 16;
const MAX_COLS = 120;
const ZOOM_STEP = 4;

interface CliOptions {
  altScreen: boolean;
  cols: number;
  fps: number | null;
  framesDir: string;
  loop: boolean;
  seconds: number | null;
  threshold: number;
  videoPath: string | null;
}

interface CropRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface ImageSize {
  width: number;
  height: number;
}

interface Sample {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface AnimationSource {
  crop: CropRect;
  framePaths: readonly string[];
}

interface ViewerState {
  cols: number;
  frameIndex: number;
  paused: boolean;
}

function printHelp() {
  process.stdout.write(`rndr-2d braille animation viewer

Usage:
  pnpm demo:braille-viewer
  pnpm demo:braille-viewer -- --loop
  pnpm demo:braille-viewer -- --cols 52 --threshold 0.14
  pnpm demo:braille-viewer -- --frames ./frames --video ./preview.mp4

Runtime controls:
  + / = / ]   zoom in
  - / [       zoom out
  Space       pause or resume
  Left/Right  scrub frames
  R           restart animation
  Esc or Q    exit

Notes:
  - Defaults to the pink gunslinger idle animation shared during rndr-2d braille work
  - Uses the preview video FPS when available so playback matches the source timing
  - Locks crop and anchor from frame 1 so the sprite does not drift between frames

Flags:
  --frames <dir>       directory containing ordered PNG frames
  --video <path>       preview video used for FPS detection
  --fps <n>            override detected FPS
  --cols <n>           braille render width in terminal cells, default 52
  --threshold <n>      braille activation threshold between 0 and 1, default 0.14
  --seconds <n>        stop after n seconds
  --loop               force looping even outside interactive TTY mode
  --no-alt             do not enter alt screen
  --help               show this message
`);
}

function parseArgs(argv: readonly string[]): CliOptions | null {
  const options: CliOptions = {
    altScreen: true,
    cols: 52,
    fps: null,
    framesDir: DEFAULT_FRAMES_DIR,
    loop: false,
    seconds: null,
    threshold: 0.14,
    videoPath: DEFAULT_VIDEO_PATH
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg || arg === "--") {
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

    if (arg === "--frames") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--frames requires a directory path.");
      }

      options.framesDir = raw;
      index += 1;
      continue;
    }

    if (arg === "--video") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--video requires a file path.");
      }

      options.videoPath = raw;
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

    if (arg === "--cols") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--cols requires a number.");
      }

      options.cols = Number(raw);
      index += 1;
      continue;
    }

    if (arg === "--threshold") {
      const raw = argv[index + 1];

      if (!raw) {
        throw new Error("--threshold requires a number.");
      }

      options.threshold = Number(raw);
      index += 1;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.cols) || options.cols <= 0) {
    throw new Error("--cols must be a positive integer.");
  }

  if (options.fps !== null && (!Number.isFinite(options.fps) || options.fps <= 0)) {
    throw new Error("--fps must be a positive number.");
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 1) {
    throw new Error("--threshold must be between 0 and 1.");
  }

  if (options.seconds !== null && (!Number.isFinite(options.seconds) || options.seconds <= 0)) {
    throw new Error("--seconds must be a positive number.");
  }

  return options;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function alignUp(value: number, multiple: number) {
  return Math.ceil(value / multiple) * multiple;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function luminance(sample: Sample) {
  return (0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b) / 255;
}

function readSample(rgba: Buffer, width: number, x: number, y: number): Sample {
  const offset = (y * width + x) * 4;

  return {
    r: rgba[offset] ?? 0,
    g: rgba[offset + 1] ?? 0,
    b: rgba[offset + 2] ?? 0,
    a: rgba[offset + 3] ?? 0
  };
}

function parseGeometry(raw: string) {
  const match = raw.trim().match(/^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/u);

  if (!match) {
    throw new Error(`Failed to parse ImageMagick geometry: ${raw}`);
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4])
  } satisfies CropRect;
}

async function readFramePaths(framesDir: string) {
  const entries = await readdir(framesDir, { withFileTypes: true });
  const framePaths = entries
    .filter((entry) => entry.isFile() && /\.png$/iu.test(entry.name))
    .map((entry) => path.join(framesDir, entry.name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (framePaths.length === 0) {
    throw new Error(`No PNG frames found in ${framesDir}.`);
  }

  return framePaths;
}

async function readTrimmedCrop(source: string) {
  const { stdout } = await execFileAsync("convert", [source, "-trim", "-format", "%wx%h%O", "info:"]);
  return parseGeometry(stdout);
}

async function readVideoFps(videoPath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=avg_frame_rate",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath
  ]);
  const raw = stdout.trim();
  const [numeratorRaw, denominatorRaw] = raw.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw ?? "1");

  if (!Number.isFinite(numerator) || numerator <= 0 || !Number.isFinite(denominator) || denominator <= 0) {
    throw new Error(`Failed to read FPS from ${videoPath}.`);
  }

  return numerator / denominator;
}

async function readCroppedRgbaRaster(source: string, crop: CropRect, size: ImageSize) {
  const { stdout } = await execFileAsync(
    "convert",
    [
      source,
      "-crop",
      `${crop.width}x${crop.height}+${crop.x}+${crop.y}`,
      "+repage",
      "-background",
      "none",
      "-alpha",
      "on",
      "-resize",
      `${size.width}x${size.height}!`,
      "-colorspace",
      "sRGB",
      "-depth",
      "8",
      "rgba:-"
    ],
    {
      encoding: "buffer",
      maxBuffer: size.width * size.height * 4 * 4
    }
  );

  const data = stdout as Buffer;
  const expectedBytes = size.width * size.height * 4;

  if (data.length !== expectedBytes) {
    throw new Error(
      `RGBA raster size mismatch for ${source}: expected ${expectedBytes} bytes, got ${data.length}.`
    );
  }

  return data;
}

function dotSizeFromCrop(crop: CropRect, cols: number) {
  const width = alignUp(cols * 2, 2);
  const height = alignUp(
    Math.max(4, Math.round((crop.height / Math.max(crop.width, 1)) * width)),
    4
  );

  return { width, height } satisfies ImageSize;
}

function renderBrailleSurface(rgba: Buffer, width: number, height: number, threshold: number) {
  const surface = BrailleSurface.fromDotSize(width, height, {
    activationThreshold: threshold
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = readSample(rgba, width, x, y);
      const alpha = sample.a / 255;
      const intensity = luminance(sample) * alpha;

      surface.paintDot(x, y, {
        value: intensity,
        style: {
          foreground: rgbColor(sample.r, sample.g, sample.b)
        }
      });
    }
  }

  return Surface.fromRaster(surface);
}

function centerFrame(sprite: SurfaceFrame, terminalColumns: number, terminalRows: number) {
  const frame = new Surface(terminalColumns, terminalRows, createCell(" "));
  const x = Math.floor((terminalColumns - sprite.width) / 2);
  const y = Math.floor((terminalRows - sprite.height) / 2);

  frame.blit(sprite, { x, y });
  return frame;
}

async function loadAnimationSource(framesDir: string) {
  const framePaths = await readFramePaths(framesDir);
  const firstFrame = framePaths[0];

  if (!firstFrame) {
    throw new Error(`No frames available in ${framesDir}.`);
  }

  return {
    crop: await readTrimmedCrop(firstFrame),
    framePaths
  } satisfies AnimationSource;
}

async function renderAnimationFrames(source: AnimationSource, cols: number, threshold: number) {
  const dotSize = dotSizeFromCrop(source.crop, cols);
  const surfaces: SurfaceFrame[] = [];

  for (const framePath of source.framePaths) {
    const rgba = await readCroppedRgbaRaster(framePath, source.crop, dotSize);
    surfaces.push(renderBrailleSurface(rgba, dotSize.width, dotSize.height, threshold));
  }

  if (surfaces.length === 0) {
    throw new Error("Braille viewer requires at least one frame.");
  }

  return surfaces;
}

function resolveTerminalSize(sprite: SurfaceFrame) {
  return {
    columns: Math.max(1, process.stdout.columns ?? sprite.width),
    rows: Math.max(1, process.stdout.rows ?? sprite.height)
  };
}

function applyFrameDelta(frameIndex: number, delta: number, frameCount: number) {
  if (frameCount <= 0) {
    return 0;
  }

  return ((frameIndex + delta) % frameCount + frameCount) % frameCount;
}

function quantizeCols(cols: number) {
  return clamp(Math.round(cols), MIN_COLS, MAX_COLS);
}

function onKeypress(state: ViewerState, key: readline.Key, frameCount: number) {
  if (key.name === "escape" || key.sequence === "q") {
    return { type: "exit" } as const;
  }

  if (key.name === "space") {
    state.paused = !state.paused;
    return { type: "toggle-pause" } as const;
  }

  if (key.name === "left") {
    state.frameIndex = applyFrameDelta(state.frameIndex, -1, frameCount);
    state.paused = true;
    return { type: "scrub" } as const;
  }

  if (key.name === "right") {
    state.frameIndex = applyFrameDelta(state.frameIndex, 1, frameCount);
    state.paused = true;
    return { type: "scrub" } as const;
  }

  switch (key.sequence) {
    case "+":
    case "=":
    case "]":
      return { type: "zoom", cols: quantizeCols(state.cols + ZOOM_STEP) } as const;
    case "-":
    case "_":
    case "[":
      return { type: "zoom", cols: quantizeCols(state.cols - ZOOM_STEP) } as const;
    case "r":
      state.frameIndex = 0;
      return { type: "reset" } as const;
    default:
      return { type: "noop" } as const;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    return;
  }

  const viewerOptions = options;
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const source = await loadAnimationSource(viewerOptions.framesDir);
  const fps = viewerOptions.fps ?? (viewerOptions.videoPath ? await readVideoFps(viewerOptions.videoPath) : 25);
  const frameIntervalMs = 1000 / fps;
  const state: ViewerState = {
    cols: quantizeCols(viewerOptions.cols),
    frameIndex: 0,
    paused: false
  };
  const frameCache = new Map<number, Promise<SurfaceFrame[]>>();
  const startedAt = Date.now();
  const shouldLoop = viewerOptions.loop || interactive;
  let previousFrame: SurfaceFrame | null = null;
  let cleanedUp = false;
  let stopRequested = false;
  let pendingZoomCols: number | null = null;
  let latestZoomToken = 0;

  function getFramesForCols(cols: number) {
    const zoomCols = quantizeCols(cols);
    const cached = frameCache.get(zoomCols);

    if (cached) {
      return cached;
    }

    const promise = renderAnimationFrames(source, zoomCols, viewerOptions.threshold);
    frameCache.set(zoomCols, promise);
    return promise;
  }

  let activeSurfaces = await getFramesForCols(state.cols);

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (interactive) {
      process.stdin.off("keypress", handleKeypress);
      process.stdin.setRawMode(false);
    }

    const parts = [ANSI_RESET, showTerminalCursor()];

    if (viewerOptions.altScreen) {
      parts.push(leaveAltScreen());
    }

    process.stdout.write(parts.join(""));
  };

  const stop = (exitCode = 0) => {
    stopRequested = true;
    cleanup();
    process.exit(exitCode);
  };

  const requestZoom = (cols: number) => {
    const nextCols = quantizeCols(cols);

    if (nextCols === state.cols || nextCols === pendingZoomCols) {
      return;
    }

    pendingZoomCols = nextCols;
    const token = ++latestZoomToken;

    void getFramesForCols(nextCols)
      .then((surfaces) => {
        if (token !== latestZoomToken) {
          return;
        }

        activeSurfaces = surfaces;
        state.cols = nextCols;
        state.frameIndex = applyFrameDelta(state.frameIndex, 0, activeSurfaces.length);
        pendingZoomCols = null;
      })
      .catch((error: unknown) => {
        cleanup();
        process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exit(1);
      });
  };

  const handleKeypress = (_str: string, key: readline.Key) => {
    const action = onKeypress(state, key, activeSurfaces.length);

    if (action.type === "exit") {
      stop(0);
      return;
    }

    if (action.type === "zoom") {
      requestZoom(action.cols);
    }
  };

  process.on("SIGINT", () => stop(130));
  process.on("SIGTERM", () => stop(143));
  process.on("uncaughtException", (error) => {
    cleanup();
    process.stderr.write(`${error.stack ?? String(error)}\n`);
    process.exit(1);
  });

  if (interactive) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", handleKeypress);
  }

  if (viewerOptions.altScreen) {
    process.stdout.write(`${enterAltScreen()}${hideTerminalCursor()}`);
  }

  while (!stopRequested) {
    const elapsedMs = Date.now() - startedAt;

    if (viewerOptions.seconds !== null && elapsedMs >= viewerOptions.seconds * 1000) {
      break;
    }

    const sprite = activeSurfaces[state.frameIndex];

    if (!sprite) {
      break;
    }

    const terminalSize = resolveTerminalSize(sprite);
    const frame = centerFrame(sprite, terminalSize.columns, terminalSize.rows);
    const output = previousFrame
      ? renderSurfaceDiffAnsi(previousFrame, frame, { resetAtEnd: true })
      : renderSurfaceAnsi(frame, { resetAtEnd: true });

    process.stdout.write(output);
    previousFrame = frame;

    if (!state.paused) {
      const nextFrameIndex = state.frameIndex + 1;

      if (nextFrameIndex >= activeSurfaces.length) {
        if (shouldLoop) {
          state.frameIndex = 0;
        } else {
          break;
        }
      } else {
        state.frameIndex = nextFrameIndex;
      }
    }

    await sleep(frameIntervalMs);
  }

  cleanup();

  if (!viewerOptions.altScreen) {
    process.stdout.write("\n");
  }
}

await main();
