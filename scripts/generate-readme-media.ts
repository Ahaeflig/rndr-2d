import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { CellStyle, Surface, SurfaceDiffStats, SurfaceStats, TerminalColor } from "../src/index.js";
import { summarizeSurface, summarizeSurfaceDiff } from "../src/index.js";
import { buildLiveDemoFrame } from "../examples/live-scene.js";

const execFileAsync = promisify(execFile);

const FRAME_COUNT = 12;
const FRAME_STEP_MS = 140;
const OUTPUT_DIR = join(process.cwd(), "docs", "media");
const OUTPUT_GIF = join(OUTPUT_DIR, "live-demo.gif");
const OUTPUT_POSTER = join(OUTPUT_DIR, "live-demo.png");
const FONT_FAMILY = "DejaVu Sans Mono";
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

      glyphs.push(
        `<text x="${pixelX}" y="${pixelY + BASELINE}" fill="${colors.foreground}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" font-weight="${fontWeight}" font-style="${fontStyle}" xml:space="preserve"${textDecoration}${opacity}>${escapeXml(cell.glyph)}</text>`
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

async function renderGif(framePattern: string, palettePath: string, outputPath: string) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    "9",
    "-i",
    framePattern,
    "-vf",
    "palettegen=reserve_transparent=0",
    palettePath
  ]);
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate",
    "9",
    "-i",
    framePattern,
    "-i",
    palettePath,
    "-lavfi",
    "paletteuse=dither=bayer:bayer_scale=3",
    outputPath
  ]);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "rndr-2d-readme-media-"));
  let previousFrame: Surface | null = null;
  let previousStats: SurfaceStats | null = null;
  let previousDiff: SurfaceDiffStats | null = null;

  try {
    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const frame = buildLiveDemoFrame({
        elapsedMs: index * FRAME_STEP_MS,
        frameNumber: index,
        fps: 18,
        previousStats,
        previousDiff
      });
      const svgPath = join(tempDir, `frame-${String(index).padStart(3, "0")}.svg`);
      const pngPath = join(tempDir, `frame-${String(index).padStart(3, "0")}.png`);

      await writeFile(svgPath, renderSurfaceSvg(frame), "utf8");
      await renderPng(svgPath, pngPath);

      if (index === Math.floor(FRAME_COUNT / 2)) {
        await copyFile(pngPath, OUTPUT_POSTER);
      }

      previousDiff = summarizeSurfaceDiff(previousFrame, frame);
      previousStats = summarizeSurface(frame);
      previousFrame = frame;
    }

    await renderGif(join(tempDir, "frame-%03d.png"), join(tempDir, "palette.png"), OUTPUT_GIF);
    process.stdout.write(`Wrote README media to ${OUTPUT_DIR}\n`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
