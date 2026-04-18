import { cellEquals } from "./cell.js";
import type { RasterSource } from "./raster.js";

export interface PlainRenderOptions {
  blankGlyph?: string;
  trimRight?: boolean;
}

export interface SurfaceStats {
  width: number;
  height: number;
  nonEmptyCellCount: number;
  blankGlyphCellCount: number;
  nonBlankGlyphCellCount: number;
  styledCellCount: number;
  uniqueGlyphCount: number;
  uniqueGlyphs: string[];
  occupiedBounds:
    | {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      }
    | null;
}

export interface SurfaceDiffStats {
  dimensionChanged: boolean;
  changedCellCount: number;
  changedRunCount: number;
}

function renderLines(source: RasterSource, options: PlainRenderOptions = {}) {
  const blankGlyph = options.blankGlyph ?? " ";
  const trimRight = options.trimRight ?? false;
  const lines: string[] = [];

  for (let y = 0; y < source.height; y += 1) {
    let line = "";

    for (let x = 0; x < source.width; x += 1) {
      line += source.cellAt(x, y)?.glyph ?? blankGlyph;
    }

    lines.push(trimRight ? line.replace(/\s+$/u, "") : line);
  }

  return lines;
}

function padRowLabel(row: number, width: number) {
  return String(row).padStart(width, "0");
}

export function renderSurfacePlain(source: RasterSource, options: PlainRenderOptions = {}) {
  return renderLines(source, options).join("\n");
}

export function renderSurfaceWithAxes(source: RasterSource, options: PlainRenderOptions = {}) {
  const lines = renderLines(source, options);
  const rowLabelWidth = Math.max(2, String(Math.max(0, source.height - 1)).length);
  const tens = Array.from({ length: source.width }, (_, index) => Math.floor(index / 10) % 10).join("");
  const ones = Array.from({ length: source.width }, (_, index) => index % 10).join("");
  const output: string[] = [];

  output.push(`${" ".repeat(rowLabelWidth)} ${tens}`);
  output.push(`${" ".repeat(rowLabelWidth)} ${ones}`);

  for (let row = 0; row < lines.length; row += 1) {
    output.push(`${padRowLabel(row, rowLabelWidth)} ${lines[row] ?? ""}`);
  }

  return output.join("\n");
}

export function summarizeSurface(source: RasterSource): SurfaceStats {
  let nonEmptyCellCount = 0;
  let blankGlyphCellCount = 0;
  let nonBlankGlyphCellCount = 0;
  let styledCellCount = 0;
  const uniqueGlyphs = new Set<string>();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const cell = source.cellAt(x, y);

      if (!cell) {
        continue;
      }

      nonEmptyCellCount += 1;
      uniqueGlyphs.add(cell.glyph);

      if (cell.glyph.trim().length === 0) {
        blankGlyphCellCount += 1;
      } else {
        nonBlankGlyphCellCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      if (cell.style) {
        styledCellCount += 1;
      }
    }
  }

  return {
    width: source.width,
    height: source.height,
    nonEmptyCellCount,
    blankGlyphCellCount,
    nonBlankGlyphCellCount,
    styledCellCount,
    uniqueGlyphCount: uniqueGlyphs.size,
    uniqueGlyphs: [...uniqueGlyphs].sort(),
    occupiedBounds:
      nonBlankGlyphCellCount === 0
        ? null
        : {
            minX,
            minY,
            maxX,
            maxY
          }
  };
}

export function summarizeSurfaceDiff(previous: RasterSource | null, next: RasterSource): SurfaceDiffStats {
  if (!previous || previous.width !== next.width || previous.height !== next.height) {
    return {
      dimensionChanged: true,
      changedCellCount: next.width * next.height,
      changedRunCount: next.height > 0 ? next.height : 0
    };
  }

  let changedCellCount = 0;
  let changedRunCount = 0;

  for (let y = 0; y < next.height; y += 1) {
    let inRun = false;

    for (let x = 0; x < next.width; x += 1) {
      const changed = !cellEquals(previous.cellAt(x, y), next.cellAt(x, y));

      if (changed) {
        changedCellCount += 1;
      }

      if (changed && !inRun) {
        changedRunCount += 1;
        inRun = true;
      }

      if (!changed) {
        inRun = false;
      }
    }
  }

  return {
    dimensionChanged: false,
    changedCellCount,
    changedRunCount
  };
}

export function visualizeAnsi(text: string) {
  return text
    .replace(/\x1b/gu, "^[")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n\n");
}
