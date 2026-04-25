import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import {
  BrailleSurface,
  Surface,
  createCell,
  rgbColor,
  summarizeSurface,
  type CellStyle,
  type TerminalColor
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = join(process.cwd(), "docs", "media");
const OUTPUT_FILE = join(OUTPUT_DIR, "braille-tuning.png");
const SOURCE_FRAME =
  process.env.RNDR2D_BRAILLE_TUNING_FRAME ??
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/frames/frame_0050.png";
const SOURCE_CROP_REFERENCE =
  process.env.RNDR2D_BRAILLE_TUNING_CROP ??
  "/home/ahaeflig/projects/pix-token/runs/pink_gunslinger_seedance20_idle_south_20260420_probe_lockcam_v2/animation/frames/frame_0001.png";

const PANEL_COLS = 92;
const PANEL_FRAME_WIDTH = 96;
const PANEL_FRAME_HEIGHT = 46;
const PANEL_GAP = 6;
const CANVAS_WIDTH = PANEL_FRAME_WIDTH * 3 + PANEL_GAP * 2 + 4;
const CANVAS_HEIGHT = 54;

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

interface CropGeometry {
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

interface TuningPreset {
  name: string;
  threshold: number;
  lumaWeight: number;
  chromaWeight: number;
  gamma: number;
  accent: [number, number, number];
}

const PRESETS: readonly TuningPreset[] = [
  {
    name: "soft",
    threshold: 0.1,
    lumaWeight: 0.58,
    chromaWeight: 0.92,
    gamma: 0.82,
    accent: [120, 214, 255]
  },
  {
    name: "balanced",
    threshold: 0.16,
    lumaWeight: 0.6,
    chromaWeight: 0.7,
    gamma: 1,
    accent: [255, 188, 223]
  },
  {
    name: "crisp",
    threshold: 0.24,
    lumaWeight: 0.46,
    chromaWeight: 1.04,
    gamma: 1.26,
    accent: [255, 214, 122]
  }
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
      const codePoint = cell.glyph.codePointAt(0) ?? 0;
      const fontFamily =
        codePoint >= 0x2800 && codePoint <= 0x28ff ? BRAILLE_FONT_FAMILY : TEXT_FONT_FAMILY;

      glyphs.push(
        `<text x="${pixelX}" y="${pixelY + BASELINE}" fill="${colors.foreground}" font-family="${fontFamily}" font-size="${FONT_SIZE}" font-weight="${fontWeight}" font-style="${fontStyle}" xml:space="preserve">${escapeXml(cell.glyph)}</text>`
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

function shapeIntensity(raw: number, gamma: number) {
  return Math.pow(Math.min(1, Math.max(0, raw)), gamma);
}

function renderBrailleSurface(
  rgba: Buffer,
  width: number,
  height: number,
  preset: TuningPreset
) {
  const surface = BrailleSurface.fromDotSize(width, height, {
    activationThreshold: preset.threshold
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = readSample(rgba, width, x, y);
      const alpha = sample.a / 255;
      const raw =
        Math.min(1, luminance(sample) * preset.lumaWeight + sampleChroma(sample) * preset.chromaWeight) *
        alpha;
      const intensity = shapeIntensity(raw, preset.gamma);

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

async function readTrimmedCropGeometry(source: string) {
  const { stdout } = await execFileAsync("convert", [source, "-trim", "-format", "%wx%h%O", "info:"]);
  const raw = stdout.trim();
  const match = raw.match(/^(\d+)x(\d+)\+(-?\d+)\+(-?\d+)$/u);

  if (!match) {
    throw new Error(`Failed to parse trim geometry for ${source}: ${raw}`);
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4])
  } satisfies CropGeometry;
}

async function readCroppedRgbaRaster(source: string, crop: CropGeometry, size: ImageSize) {
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
      `RGBA raster size mismatch for ${basename(source)}: expected ${expectedBytes} bytes, got ${data.length}.`
    );
  }

  return data;
}

function anchorForBraille(surface: BrailleSurface) {
  const occupiedBounds = summarizeSurface(surface.toSurface()).occupiedBounds;
  const visibleWidth = occupiedBounds ? occupiedBounds.maxX - occupiedBounds.minX + 1 : surface.width;
  const visibleHeight = occupiedBounds ? occupiedBounds.maxY - occupiedBounds.minY + 1 : surface.height;

  return occupiedBounds
    ? {
        x: Math.floor((PANEL_FRAME_WIDTH - visibleWidth) / 2) - occupiedBounds.minX,
        y: Math.floor((PANEL_FRAME_HEIGHT - visibleHeight) / 2) - occupiedBounds.minY
      }
    : {
        x: Math.floor((PANEL_FRAME_WIDTH - surface.width) / 2),
        y: Math.floor((PANEL_FRAME_HEIGHT - surface.height) / 2)
      };
}

function makePanel(preset: TuningPreset, braille: BrailleSurface, anchor: { x: number; y: number }) {
  const surface = new Surface(
    PANEL_FRAME_WIDTH,
    PANEL_FRAME_HEIGHT,
    createCell(" ", {
      background: rgbColor(7, 8, 14)
    })
  );

  surface.blit(braille, { x: anchor.x + 1, y: anchor.y + 1 }, {
    style: {
      foreground: rgbColor(28, 20, 42),
      dim: true
    }
  });
  surface.blit(braille, { x: anchor.x - 1, y: anchor.y + 1 }, {
    style: {
      foreground: rgbColor(124, 66, 126),
      dim: true
    }
  });
  surface.blit(braille, { x: anchor.x, y: anchor.y - 1 }, {
    style: {
      foreground: rgbColor(218, 102, 172),
      dim: true
    }
  });
  surface.blit(braille, anchor);

  surface.drawText({ x: 2, y: 1 }, preset.name, {
    foreground: rgbColor(...preset.accent),
    bold: true
  });
  surface.drawText(
    { x: 2, y: PANEL_FRAME_HEIGHT - 2 },
    `t ${preset.threshold.toFixed(2)}  g ${preset.gamma.toFixed(2)}`,
    {
      foreground: rgbColor(126, 134, 164)
    }
  );

  return surface;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const crop = await readTrimmedCropGeometry(SOURCE_CROP_REFERENCE);
  const microWidth = PANEL_COLS * 2;
  const microHeight = alignUp(Math.max(4, Math.round((crop.height / crop.width) * microWidth)), 4);
  const scaledSize = {
    width: microWidth,
    height: microHeight
  } satisfies ImageSize;
  const rgba = await readCroppedRgbaRaster(SOURCE_FRAME, crop, scaledSize);
  const panels = PRESETS.map((preset) => {
    const braille = renderBrailleSurface(rgba, scaledSize.width, scaledSize.height, preset);
    return makePanel(preset, braille, anchorForBraille(braille));
  });

  const canvas = new Surface(
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    createCell(" ", {
      background: rgbColor(7, 8, 14)
    })
  );

  canvas.drawText({ x: 3, y: 2 }, "braille tuning comparison", {
    foreground: rgbColor(240, 244, 250),
    bold: true
  });
  canvas.drawText({ x: 3, y: 4 }, basename(SOURCE_FRAME), {
    foreground: rgbColor(132, 143, 171)
  });

  panels.forEach((panel, index) => {
    canvas.blit(panel, { x: 2 + index * (PANEL_FRAME_WIDTH + PANEL_GAP), y: 5 });
  });

  const svgPath = join(OUTPUT_DIR, "braille-tuning.svg");
  await writeFile(svgPath, renderSurfaceSvg(canvas), "utf8");
  await execFileAsync("convert", [svgPath, OUTPUT_FILE]);
  process.stdout.write(`Wrote braille tuning comparison to ${OUTPUT_FILE}\n`);
}

await main();
