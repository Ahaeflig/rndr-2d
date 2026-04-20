import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  BrailleSurface,
  type RasterSource,
  Surface,
  createCell,
  renderSurfaceAnsi,
  rgbColor
} from "../src/index.js";

const execFileAsync = promisify(execFile);

interface CliOptions {
  source: string;
  cols: number;
  threshold: number;
  showHeader: boolean;
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

function printHelp() {
  process.stdout.write(`rndr-2d png -> braille demo

Usage:
  pnpm demo:png-braille
  pnpm demo:png-braille -- ./path/to/image.png
  pnpm demo:png-braille -- ./path/to/image.png --cols 80
  pnpm demo:png-braille -- rose:

Notes:
  - Defaults to ImageMagick's built-in 'rose:' image if no source is given
  - Renders into Unicode braille cells using ANSI foreground colors
  - Each terminal cell encodes a 2x4 micro-grid

Flags:
  --cols <n>        terminal columns for the braille image, default 64
  --threshold <n>   activation threshold between 0 and 1, default 0.18
  --no-header       omit the descriptive header lines
  --help            show this message
`);
}

function parseArgs(argv: readonly string[]): CliOptions | null {
  const options: CliOptions = {
    source: "rose:",
    cols: 64,
    threshold: 0.18,
    showHeader: true
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === "--") {
      continue;
    }

    if (arg === "--help") {
      printHelp();
      return null;
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

    if (arg === "--no-header") {
      options.showHeader = false;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    options.source = arg;
  }

  if (!Number.isInteger(options.cols) || options.cols <= 0) {
    throw new Error("--cols must be a positive integer.");
  }

  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 1) {
    throw new Error("--threshold must be between 0 and 1.");
  }

  return options;
}

function alignUp(value: number, multiple: number) {
  return Math.ceil(value / multiple) * multiple;
}

async function readImageSize(source: string) {
  const { stdout } = await execFileAsync("convert", [source, "-format", "%w %h", "info:"]);
  const [widthRaw, heightRaw] = stdout.trim().split(/\s+/u);
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`Failed to read image size for ${source}.`);
  }

  return { width, height } satisfies ImageSize;
}

async function readRgbaRaster(source: string, size: ImageSize) {
  const { stdout } = await execFileAsync(
    "convert",
    [
      source,
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

  return surface;
}

function renderFrame(
  surface: RasterSource,
  options: CliOptions,
  scaledSize: ImageSize,
  sourceSize: ImageSize
) {
  const headerRows = options.showHeader ? 4 : 0;
  const frame = new Surface(
    Math.max(surface.width, 1),
    surface.height + headerRows,
    createCell(" ")
  );

  if (options.showHeader) {
    frame.drawText({ x: 0, y: 0 }, "rndr-2d image -> braille experiment", {
      foreground: rgbColor(240, 244, 250),
      bold: true
    });
    frame.drawText(
      { x: 0, y: 1 },
      `source: ${options.source}  original: ${sourceSize.width}x${sourceSize.height}  scaled: ${scaledSize.width}x${scaledSize.height}`,
      {
        foreground: rgbColor(148, 159, 179)
      }
    );
    frame.drawText(
      { x: 0, y: 2 },
      `braille cells: ${surface.width}x${surface.height}  micro-grid: 2x4 per cell  threshold: ${options.threshold.toFixed(2)}`,
      {
        foreground: rgbColor(110, 183, 255)
      }
    );
    frame.drawText(
      { x: 0, y: 3 },
      "This is still text-mode terminal output; the extra shape comes from denser glyph encoding.",
      {
        foreground: rgbColor(126, 206, 144)
      }
    );
  }

  frame.blit(surface, { x: 0, y: headerRows });
  return frame;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options) {
    return;
  }

  const sourceSize = await readImageSize(options.source);
  const microWidth = options.cols * 2;
  const scaledHeight = alignUp(
    Math.max(4, Math.round((sourceSize.height / sourceSize.width) * microWidth)),
    4
  );
  const scaledSize = {
    width: microWidth,
    height: scaledHeight
  } satisfies ImageSize;
  const rgba = await readRgbaRaster(options.source, scaledSize);
  const braille = renderBrailleSurface(rgba, scaledSize.width, scaledSize.height, options.threshold);
  const frame = renderFrame(braille, options, scaledSize, sourceSize);

  process.stdout.write(renderSurfaceAnsi(frame));
  process.stdout.write("\n");
}

await main();
