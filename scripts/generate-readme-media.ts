import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { buildLiveDemoFrame } from "../examples/live-scene.js";
import {
  BrailleSurface,
  Surface,
  createCell,
  rgbColor,
  summarizeSurface,
  summarizeSurfaceDiff,
  type CellStyle,
  type SurfaceDiffStats,
  type SurfaceStats,
  type TerminalColor
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = join(process.cwd(), "docs", "media");
const LIVE_DEMO_GIF = join(OUTPUT_DIR, "live-demo.gif");
const LIVE_DEMO_POSTER = join(OUTPUT_DIR, "live-demo.png");
const BRAILLE_SHOWCASE_GIF = join(OUTPUT_DIR, "braille-showcase.gif");
const BRAILLE_SHOWCASE_POSTER = join(OUTPUT_DIR, "braille-showcase.png");

const LIVE_FRAME_COUNT = 12;
const LIVE_FRAME_STEP_MS = 140;
const LIVE_FPS = 9;

const BRAILLE_SHOWCASE_COLS = 68;
const BRAILLE_SHOWCASE_THRESHOLD = 0.16;
const BRAILLE_FRAME_WIDTH = 72;
const BRAILLE_FRAME_HEIGHT = 38;
const DEFAULT_BRAILLE_FRAMES_DIR =
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/frames";
const DEFAULT_BRAILLE_VIDEO =
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/preview_on_light.mp4";

const TEXT_FONT_FAMILY = "DejaVu Sans Mono";
const BRAILLE_FONT_FAMILY = "Noto Sans Symbols2";
const CELL_WIDTH = 12;
const CELL_HEIGHT = 22;
const FONT_SIZE = 18;
const BASELINE = 17;
const PADDING = 20;
const DEFAULT_FOREGROUND = "#f4f6fa";
const DEFAULT_BACKGROUND = "#0a0a10";

const ANSI_BASE_COLORS = [
  "#000000",
  "#800000",
  "#008000",
  "#808000",
  "#000080",
  "#800080",
  "#008080",
  "#c0c0c0",
  "#808080",
  "#ff0000",
  "#00ff00",
  "#ffff00",
  "#0000ff",
  "#ff00ff",
  "#00ffff",
  "#ffffff"
] as const;

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

function escapeXml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function componentToHex(value: number) {
  return value.toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function ansi256ToHex(code: number) {
  if (code < ANSI_BASE_COLORS.length) {
    return ANSI_BASE_COLORS[code] ?? DEFAULT_FOREGROUND;
  }

  if (code >= 16 && code <= 231) {
    const normalized = code - 16;
    const red = Math.floor(normalized / 36);
    const green = Math.floor((normalized % 36) / 6);
    const blue = normalized % 6;
    const convert = (component: number) => (component === 0 ? 0 : 55 + component * 40);
    return rgbToHex(convert(red), convert(green), convert(blue));
  }

  if (code >= 232 && code <= 255) {
    const shade = 8 + (code - 232) * 10;
    return rgbToHex(shade, shade, shade);
  }

  return DEFAULT_FOREGROUND;
}

function colorToCss(color: TerminalColor | undefined, fallback: string) {
  if (!color || color.kind === "default") {
    return fallback;
  }

  if (color.kind === "rgb") {
    return rgbToHex(color.r, color.g, color.b);
  }

  return ansi256ToHex(color.code);
}

function styleColors(style: CellStyle | undefined, defaultForeground: string, defaultBackground: string) {
  const foreground = colorToCss(style?.foreground, defaultForeground);
  const background = colorToCss(style?.background, defaultBackground);

  if (style?.inverse) {
    return {
      foreground: background,
      background: foreground
    };
  }

  return {
    foreground,
    background
  };
}

function dominantBackground(surface: Surface) {
  const counts = new Map<string, number>();

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const background = colorToCss(surface.cellAt(x, y)?.style?.background, DEFAULT_BACKGROUND);
      counts.set(background, (counts.get(background) ?? 0) + 1);
    }
  }

  let winner = DEFAULT_BACKGROUND;
  let highest = -1;

  for (const [color, count] of counts.entries()) {
    if (count > highest) {
      winner = color;
      highest = count;
    }
  }

  return winner;
}

function renderSurfaceSvg(surface: Surface) {
  const width = surface.width * CELL_WIDTH + PADDING * 2;
  const height = surface.height * CELL_HEIGHT + PADDING * 2;
  const background = dominantBackground(surface);
  const rects: string[] = [];
  const glyphs: string[] = [];

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.cellAt(x, y);
      const style = cell?.style;
      const colors = styleColors(style, DEFAULT_FOREGROUND, background);
      const pixelX = PADDING + x * CELL_WIDTH;
      const pixelY = PADDING + y * CELL_HEIGHT;

      if (colors.background !== background) {
        rects.push(
          `<rect x="${pixelX}" y="${pixelY}" width="${CELL_WIDTH}" height="${CELL_HEIGHT}" fill="${colors.background}" />`
        );
      }

      if (!cell || cell.glyph === " ") {
        continue;
      }

      const fontWeight = style?.bold ? "700" : "400";
      const fontStyle = style?.italic ? "italic" : "normal";
      const textDecoration = style?.underline ? ' text-decoration="underline"' : "";
      const opacity = style?.dim ? ' opacity="0.72"' : "";
      const codePoint = cell.glyph.codePointAt(0) ?? 0;
      const fontFamily =
        codePoint >= 0x2800 && codePoint <= 0x28ff ? BRAILLE_FONT_FAMILY : TEXT_FONT_FAMILY;

      glyphs.push(
        `<text x="${pixelX}" y="${pixelY + BASELINE}" fill="${colors.foreground}" font-family="${fontFamily}" font-size="${FONT_SIZE}" font-weight="${fontWeight}" font-style="${fontStyle}" xml:space="preserve"${textDecoration}${opacity}>${escapeXml(cell.glyph)}</text>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${background}" />
  ${rects.join("\n  ")}
  ${glyphs.join("\n  ")}
</svg>
`;
}

async function renderPng(svgPath: string, pngPath: string) {
  await execFileAsync("convert", [svgPath, pngPath]);
}

async function renderGif(framePattern: string, palettePath: string, outputPath: string, fps: number) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    framePattern,
    "-vf",
    "palettegen=reserve_transparent=0",
    palettePath
  ]);
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    framePattern,
    "-i",
    palettePath,
    "-lavfi",
    "paletteuse=dither=bayer:bayer_scale=3",
    outputPath
  ]);
}

function alignUp(value: number, multiple: number) {
  return Math.ceil(value / multiple) * multiple;
}

function luminance(sample: Sample) {
  return (0.2126 * sample.r + 0.7152 * sample.g + 0.0722 * sample.b) / 255;
}

function sampleChroma(sample: Sample) {
  const max = Math.max(sample.r, sample.g, sample.b);
  const min = Math.min(sample.r, sample.g, sample.b);
  return (max - min) / 255;
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

function renderBrailleSurface(rgba: Buffer, width: number, height: number, threshold: number) {
  const surface = BrailleSurface.fromDotSize(width, height, {
    activationThreshold: threshold
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = readSample(rgba, width, x, y);
      const alpha = sample.a / 255;
      const luminosity = luminance(sample);
      const chroma = sampleChroma(sample);
      const intensity = Math.min(1, luminosity * 0.6 + chroma * 0.7) * alpha;

      surface.paintDot(x, y, {
        value: intensity,
        style: {
          foreground: rgbColor(sample.r, sample.g, sample.b)
        }
      });
    }
  }

  return surface;
}

async function pathExists(path: string) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listPngFrames(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function readTrimmedImageSize(source: string) {
  const { stdout } = await execFileAsync("convert", [source, "-trim", "-format", "%w %h", "info:"]);
  const [widthRaw, heightRaw] = stdout.trim().split(/\s+/u);
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`Failed to read trimmed image size for ${source}.`);
  }

  return {
    width,
    height
  } satisfies ImageSize;
}

async function readTrimmedRgbaRaster(source: string, size: ImageSize) {
  const { stdout } = await execFileAsync(
    "convert",
    [
      source,
      "-trim",
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
      `RGBA raster size mismatch for ${basename(source)}: expected ${expectedBytes} bytes, got ${data.length}.`
    );
  }

  return data;
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

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new Error(`Failed to parse fps from ${videoPath}.`);
  }

  return numerator / denominator;
}

function drawShowcasePanel(surface: Surface) {
  const border = rgbColor(72, 83, 110);
  const panel = rgbColor(18, 20, 32);
  const label = rgbColor(244, 246, 250);
  const sublabel = rgbColor(152, 162, 188);
  const accent = rgbColor(255, 164, 208);

  surface.fillRect(
    {
      x: 0,
      y: 0,
      width: surface.width,
      height: surface.height
    },
    createCell(" ", {
      background: rgbColor(7, 8, 14)
    })
  );
  surface.fillRect(
    {
      x: 1,
      y: 1,
      width: surface.width - 2,
      height: surface.height - 2
    },
    createCell(" ", {
      background: panel
    })
  );
  surface.drawText({ x: 2, y: 1 }, `+${"-".repeat(surface.width - 4)}+`, {
    foreground: border
  });
  surface.drawText({ x: 2, y: surface.height - 2 }, `+${"-".repeat(surface.width - 4)}+`, {
    foreground: border
  });
  for (let y = 2; y < surface.height - 2; y += 1) {
    surface.drawText({ x: 2, y }, "|", { foreground: border });
    surface.drawText({ x: surface.width - 3, y }, "|", { foreground: border });
  }

  surface.drawText({ x: 5, y: 3 }, "BRAILLE SHOWCASE", {
    foreground: label,
    bold: true
  });
  surface.drawText({ x: 5, y: 5 }, "real sprite frames rendered as color braille cells", {
    foreground: sublabel
  });
  surface.drawText({ x: 5, y: surface.height - 5 }, "still plain terminal text output", {
    foreground: sublabel
  });
  surface.drawText({ x: 5, y: surface.height - 3 }, "2x4 micro-grid per cell", {
    foreground: accent,
    bold: true
  });

  const stars = [
    { x: 58, y: 5, glyph: "·" },
    { x: 63, y: 8, glyph: "*" },
    { x: 10, y: 31, glyph: "·" },
    { x: 58, y: 29, glyph: "·" },
    { x: 62, y: 26, glyph: "+" }
  ] as const;

  for (const star of stars) {
    surface.drawText({ x: star.x, y: star.y }, star.glyph, {
      foreground: rgbColor(98, 109, 138)
    });
  }
}

function buildBrailleShowcaseFrame(input: {
  braille: BrailleSurface;
  frameNumber: number;
  totalFrames: number;
  fps: number;
}) {
  const surface = new Surface(
    BRAILLE_FRAME_WIDTH,
    BRAILLE_FRAME_HEIGHT,
    createCell(" ", {
      background: rgbColor(7, 8, 14)
    })
  );
  const heroX = Math.floor((surface.width - input.braille.width) / 2);
  const heroY = 6;
  const topRightLabel = `${input.totalFrames} frames @ ${input.fps.toFixed(0)} fps`;
  const bottomRightLabel = `frame ${String(input.frameNumber + 1).padStart(2, "0")}`;

  drawShowcasePanel(surface);

  surface.blit(input.braille, { x: heroX + 1, y: heroY + 1 }, {
    style: {
      foreground: rgbColor(34, 24, 48),
      dim: true
    }
  });
  surface.blit(input.braille, { x: heroX - 1, y: heroY + 1 }, {
    style: {
      foreground: rgbColor(129, 73, 127),
      dim: true
    }
  });
  surface.blit(input.braille, { x: heroX + 1, y: heroY }, {
    style: {
      foreground: rgbColor(220, 108, 175),
      dim: true
    }
  });
  surface.blit(input.braille, { x: heroX, y: heroY });

  surface.drawText(
    { x: surface.width - 5 - topRightLabel.length, y: 3 },
    topRightLabel,
    {
      foreground: rgbColor(255, 188, 223)
    }
  );
  surface.drawText(
    { x: surface.width - 5 - bottomRightLabel.length, y: surface.height - 3 },
    bottomRightLabel,
    {
      foreground: rgbColor(133, 213, 255)
    }
  );

  return surface;
}

async function buildLiveDemoMedia(tempDir: string) {
  let previousFrame: Surface | null = null;
  let previousStats: SurfaceStats | null = null;
  let previousDiff: SurfaceDiffStats | null = null;

  for (let index = 0; index < LIVE_FRAME_COUNT; index += 1) {
    const frame = buildLiveDemoFrame({
      elapsedMs: index * LIVE_FRAME_STEP_MS,
      frameNumber: index,
      fps: 18,
      previousStats,
      previousDiff
    });
    const svgPath = join(tempDir, `live-${String(index).padStart(3, "0")}.svg`);
    const pngPath = join(tempDir, `live-${String(index).padStart(3, "0")}.png`);

    await writeFile(svgPath, renderSurfaceSvg(frame), "utf8");
    await renderPng(svgPath, pngPath);

    if (index === Math.floor(LIVE_FRAME_COUNT / 2)) {
      await copyFile(pngPath, LIVE_DEMO_POSTER);
    }

    previousDiff = summarizeSurfaceDiff(previousFrame, frame);
    previousStats = summarizeSurface(frame);
    previousFrame = frame;
  }

  await renderGif(join(tempDir, "live-%03d.png"), join(tempDir, "live-palette.png"), LIVE_DEMO_GIF, LIVE_FPS);
}

async function buildBrailleShowcaseMedia(tempDir: string) {
  const framesDir = process.env.RNDR2D_BRAILLE_FRAMES_DIR ?? DEFAULT_BRAILLE_FRAMES_DIR;
  const videoPath = process.env.RNDR2D_BRAILLE_VIDEO ?? DEFAULT_BRAILLE_VIDEO;

  if (!(await pathExists(framesDir)) || !(await pathExists(videoPath))) {
    process.stdout.write("Skipped braille showcase media: optional sprite source not found.\n");
    return;
  }

  const frames = await listPngFrames(framesDir);

  if (frames.length === 0) {
    process.stdout.write("Skipped braille showcase media: no PNG frames found.\n");
    return;
  }

  const fps = await readVideoFps(videoPath);
  const trimmedSize = await readTrimmedImageSize(frames[0] ?? "");
  const microWidth = BRAILLE_SHOWCASE_COLS * 2;
  const microHeight = alignUp(
    Math.max(4, Math.round((trimmedSize.height / trimmedSize.width) * microWidth)),
    4
  );
  const scaledSize = {
    width: microWidth,
    height: microHeight
  } satisfies ImageSize;

  for (let index = 0; index < frames.length; index += 1) {
    const source = frames[index] ?? frames[0]!;
    const rgba = await readTrimmedRgbaRaster(source, scaledSize);
    const braille = renderBrailleSurface(rgba, scaledSize.width, scaledSize.height, BRAILLE_SHOWCASE_THRESHOLD);
    const frame = buildBrailleShowcaseFrame({
      braille,
      frameNumber: index,
      totalFrames: frames.length,
      fps
    });
    const svgPath = join(tempDir, `braille-${String(index).padStart(3, "0")}.svg`);
    const pngPath = join(tempDir, `braille-${String(index).padStart(3, "0")}.png`);

    await writeFile(svgPath, renderSurfaceSvg(frame), "utf8");
    await renderPng(svgPath, pngPath);

    if (index === Math.floor(frames.length / 2)) {
      await copyFile(pngPath, BRAILLE_SHOWCASE_POSTER);
    }
  }

  await renderGif(
    join(tempDir, "braille-%03d.png"),
    join(tempDir, "braille-palette.png"),
    BRAILLE_SHOWCASE_GIF,
    fps
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "rndr-2d-readme-media-"));

  try {
    await buildLiveDemoMedia(tempDir);
    await buildBrailleShowcaseMedia(tempDir);
    process.stdout.write(`Wrote README media to ${OUTPUT_DIR}\n`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
