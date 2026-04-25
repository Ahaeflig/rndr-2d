import { cloneCell, createCell, type Cell } from "./cell.js";
import { colorEquals, rgbColor, type TerminalColor } from "./color.js";
import { plotLinePoints, pointInPolygon, pointInRect, type Point, type Rect, type Size } from "./geometry.js";
import type { RasterSource } from "./raster.js";
import { Sprite } from "./sprite.js";
import { Surface } from "./surface.js";
import { normalizeStyle, type CellStyle } from "./style.js";

export const BRAILLE_DOT_COLUMNS = 2;
export const BRAILLE_DOT_ROWS = 4;

export interface BrailleDot {
  value: number;
  style?: CellStyle;
}

export interface BraillePaint {
  value?: number;
  style?: CellStyle;
}

export type BrailleCellAnchor = "origin" | "center";

export interface BrailleSurfaceOptions {
  activationThreshold?: number;
}

const BRAILLE_DOT_MASKS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80]
] as const;

function assertDimension(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

function assertThreshold(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError("Braille activation threshold must be between 0 and 1.");
  }
}

function normalizePaint(input: BraillePaint | CellStyle | null | undefined): BrailleDot | null {
  if (!input) {
    return null;
  }

  if ("value" in input || "style" in input) {
    const value = input.value ?? 1;

    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError("Braille dot values must be between 0 and 1.");
    }

    const style = normalizeStyle(input.style);

    return value <= 0
      ? null
      : {
          value,
          ...(style ? { style } : {})
        };
  }

  const style = normalizeStyle(input as CellStyle);

  return {
    value: 1,
    ...(style ? { style } : {})
  };
}

function cloneDot(dot: BrailleDot | null | undefined): BrailleDot | null {
  if (!dot || dot.value <= 0) {
    return null;
  }

  return {
    value: dot.value,
    ...(dot.style ? { style: { ...dot.style } } : {})
  };
}

function strongestDot(dots: readonly BrailleDot[]) {
  let strongest: BrailleDot | null = null;

  for (const dot of dots) {
    if (!strongest || dot.value > strongest.value) {
      strongest = dot;
    }
  }

  return strongest;
}

function allColorsEqual(colors: readonly TerminalColor[]) {
  if (colors.length <= 1) {
    return true;
  }

  const first = colors[0];

  return colors.every((color) => colorEquals(color, first));
}

function weightedAverageRgb(colors: readonly { color: TerminalColor; weight: number }[]) {
  if (colors.length === 0) {
    return undefined;
  }

  if (colors.every(({ color }) => color.kind === "rgb")) {
    let total = 0;
    let red = 0;
    let green = 0;
    let blue = 0;

    for (const entry of colors) {
      if (entry.color.kind !== "rgb" || entry.weight <= 0) {
        continue;
      }

      total += entry.weight;
      red += entry.color.r * entry.weight;
      green += entry.color.g * entry.weight;
      blue += entry.color.b * entry.weight;
    }

    if (total <= 0) {
      return undefined;
    }

    return rgbColor(
      Math.round(red / total),
      Math.round(green / total),
      Math.round(blue / total)
    );
  }

  const plainColors = colors.map((entry) => entry.color);

  if (allColorsEqual(plainColors)) {
    return plainColors[0];
  }

  return undefined;
}

function aggregateStyle(activeDots: readonly BrailleDot[]) {
  if (activeDots.length === 0) {
    return undefined;
  }

  const representative = strongestDot(activeDots);
  const base = representative?.style ? { ...representative.style } : {};
  const foregrounds = activeDots
    .map((dot) => (dot.style?.foreground ? { color: dot.style.foreground, weight: dot.value } : null))
    .filter((entry): entry is { color: TerminalColor; weight: number } => entry !== null);
  const backgrounds = activeDots
    .map((dot) => (dot.style?.background ? { color: dot.style.background, weight: dot.value } : null))
    .filter((entry): entry is { color: TerminalColor; weight: number } => entry !== null);
  const foreground = weightedAverageRgb(foregrounds) ?? representative?.style?.foreground;
  const background = weightedAverageRgb(backgrounds) ?? representative?.style?.background;
  const style: CellStyle = {
    ...base,
    ...(foreground ? { foreground } : {}),
    ...(background ? { background } : {})
  };

  return normalizeStyle(style);
}

export function brailleDotPointFromCell(point: Point, anchor: BrailleCellAnchor = "origin"): Point {
  return anchor === "center"
    ? {
        x: point.x * BRAILLE_DOT_COLUMNS + (BRAILLE_DOT_COLUMNS - 1) / 2,
        y: point.y * BRAILLE_DOT_ROWS + (BRAILLE_DOT_ROWS - 1) / 2
      }
    : {
        x: point.x * BRAILLE_DOT_COLUMNS,
        y: point.y * BRAILLE_DOT_ROWS
      };
}

export function brailleDotRectFromCellRect(rect: Rect): Rect {
  return {
    x: rect.x * BRAILLE_DOT_COLUMNS,
    y: rect.y * BRAILLE_DOT_ROWS,
    width: rect.width * BRAILLE_DOT_COLUMNS,
    height: rect.height * BRAILLE_DOT_ROWS
  };
}

export function mapBrailleCellPoints(
  points: readonly Point[],
  anchor: BrailleCellAnchor = "center"
) {
  return points.map((point) => brailleDotPointFromCell(point, anchor));
}

export function brailleCellSizeFromDotSize(dotSize: Size): Size {
  assertDimension("Braille dot width", dotSize.width);
  assertDimension("Braille dot height", dotSize.height);

  return {
    width: Math.ceil(dotSize.width / BRAILLE_DOT_COLUMNS),
    height: Math.ceil(dotSize.height / BRAILLE_DOT_ROWS)
  };
}

export class BrailleSurface implements RasterSource {
  readonly width: number;
  readonly height: number;
  readonly dotWidth: number;
  readonly dotHeight: number;
  readonly activationThreshold: number;
  private readonly dots: (BrailleDot | null)[];
  private compiledCells: (Cell | null)[] | null = null;

  constructor(width: number, height: number, options: BrailleSurfaceOptions = {}) {
    assertDimension("Braille surface width", width);
    assertDimension("Braille surface height", height);
    this.width = width;
    this.height = height;
    this.dotWidth = width * BRAILLE_DOT_COLUMNS;
    this.dotHeight = height * BRAILLE_DOT_ROWS;
    this.activationThreshold = options.activationThreshold ?? 0.5;
    assertThreshold(this.activationThreshold);
    this.dots = Array.from({ length: this.dotWidth * this.dotHeight }, () => null);
  }

  static fromDotSize(dotWidth: number, dotHeight: number, options: BrailleSurfaceOptions = {}) {
    const cellSize = brailleCellSizeFromDotSize({ width: dotWidth, height: dotHeight });
    return new BrailleSurface(cellSize.width, cellSize.height, options);
  }

  private dotIndex(x: number, y: number) {
    return y * this.dotWidth + x;
  }

  private insideDots(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.dotWidth && y < this.dotHeight;
  }

  private invalidate() {
    this.compiledCells = null;
  }

  private compileCell(cellX: number, cellY: number) {
    let mask = 0;
    const activeDots: BrailleDot[] = [];

    for (let localY = 0; localY < BRAILLE_DOT_ROWS; localY += 1) {
      for (let localX = 0; localX < BRAILLE_DOT_COLUMNS; localX += 1) {
        const dot = this.dotAt(cellX * BRAILLE_DOT_COLUMNS + localX, cellY * BRAILLE_DOT_ROWS + localY);

        if (!dot || dot.value < this.activationThreshold) {
          continue;
        }

        mask |= BRAILLE_DOT_MASKS[localY]?.[localX] ?? 0;
        activeDots.push(dot);
      }
    }

    if (mask === 0) {
      return null;
    }

    return createCell(String.fromCodePoint(0x2800 + mask), aggregateStyle(activeDots));
  }

  private ensureCompiled() {
    if (this.compiledCells) {
      return;
    }

    this.compiledCells = new Array<Cell | null>(this.width * this.height).fill(null);

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.compiledCells[y * this.width + x] = this.compileCell(x, y);
      }
    }
  }

  clone() {
    const copy = new BrailleSurface(this.width, this.height, {
      activationThreshold: this.activationThreshold
    });

    for (let index = 0; index < this.dots.length; index += 1) {
      copy.dots[index] = cloneDot(this.dots[index]);
    }

    return copy;
  }

  clear(fill: BraillePaint | CellStyle | null = null) {
    const normalized = normalizePaint(fill);

    for (let index = 0; index < this.dots.length; index += 1) {
      this.dots[index] = cloneDot(normalized);
    }

    this.invalidate();
  }

  dotAt(x: number, y: number) {
    if (!this.insideDots(x, y)) {
      return null;
    }

    return cloneDot(this.dots[this.dotIndex(x, y)]);
  }

  paintDot(x: number, y: number, fill: BraillePaint | CellStyle | null) {
    const dotX = Math.round(x);
    const dotY = Math.round(y);

    if (!this.insideDots(dotX, dotY)) {
      return;
    }

    this.dots[this.dotIndex(dotX, dotY)] = cloneDot(normalizePaint(fill));
    this.invalidate();
  }

  setDot(x: number, y: number, style?: CellStyle) {
    this.paintDot(x, y, style ? { value: 1, style } : { value: 1 });
  }

  clearDot(x: number, y: number) {
    this.paintDot(x, y, null);
  }

  paintCell(x: number, y: number, fill: BraillePaint | CellStyle | null) {
    this.fillDotRect(
      {
        x: x * BRAILLE_DOT_COLUMNS,
        y: y * BRAILLE_DOT_ROWS,
        width: BRAILLE_DOT_COLUMNS,
        height: BRAILLE_DOT_ROWS
      },
      fill
    );
  }

  fillCellRect(rect: Rect, fill: BraillePaint | CellStyle | null) {
    this.fillDotRect(brailleDotRectFromCellRect(rect), fill);
  }

  fillDotRect(rect: Rect, fill: BraillePaint | CellStyle | null) {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this.dotWidth, rect.x + rect.width);
    const endY = Math.min(this.dotHeight, rect.y + rect.height);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        this.paintDot(x, y, fill);
      }
    }
  }

  drawDotLine(from: Point, to: Point, fill: BraillePaint | CellStyle | null) {
    for (const point of plotLinePoints(from, to)) {
      this.paintDot(point.x, point.y, fill);
    }
  }

  drawCellLine(
    from: Point,
    to: Point,
    fill: BraillePaint | CellStyle | null,
    anchor: BrailleCellAnchor = "center"
  ) {
    this.drawDotLine(
      brailleDotPointFromCell(from, anchor),
      brailleDotPointFromCell(to, anchor),
      fill
    );
  }

  strokePolygon(points: readonly Point[], fill: BraillePaint | CellStyle | null) {
    if (points.length < 2) {
      return;
    }

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index] ?? points[0]!;
      const end = points[(index + 1) % points.length] ?? points[0]!;
      this.drawDotLine(start, end, fill);
    }
  }

  fillPolygon(points: readonly Point[], fill: BraillePaint | CellStyle | null) {
    if (points.length < 3) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const bounds = {
      x: Math.max(0, Math.floor(minX)),
      y: Math.max(0, Math.floor(minY)),
      width: Math.min(this.dotWidth, Math.ceil(maxX) + 1) - Math.max(0, Math.floor(minX)),
      height: Math.min(this.dotHeight, Math.ceil(maxY) + 1) - Math.max(0, Math.floor(minY))
    };

    for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
        if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
          this.paintDot(x, y, fill);
        }
      }
    }
  }

  strokeCellPolygon(
    points: readonly Point[],
    fill: BraillePaint | CellStyle | null,
    anchor: BrailleCellAnchor = "center"
  ) {
    this.strokePolygon(mapBrailleCellPoints(points, anchor), fill);
  }

  fillCellPolygon(
    points: readonly Point[],
    fill: BraillePaint | CellStyle | null,
    anchor: BrailleCellAnchor = "center"
  ) {
    this.fillPolygon(mapBrailleCellPoints(points, anchor), fill);
  }

  fillCircle(center: Point, radius: number, fill: BraillePaint | CellStyle | null) {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError("Braille circle radius must be a non-negative number.");
    }

    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - center.x;
        const dy = y + 0.5 - center.y;

        if (dx * dx + dy * dy <= radius * radius) {
          this.paintDot(x, y, fill);
        }
      }
    }
  }

  strokeCircle(center: Point, radius: number, fill: BraillePaint | CellStyle | null, thickness = 1) {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError("Braille circle radius must be a non-negative number.");
    }

    if (!Number.isFinite(thickness) || thickness <= 0) {
      throw new RangeError("Braille circle thickness must be a positive number.");
    }

    const minX = Math.max(0, Math.floor(center.x - radius - thickness));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radius + thickness));
    const minY = Math.max(0, Math.floor(center.y - radius - thickness));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radius + thickness));
    const inner = Math.max(0, radius - thickness / 2);
    const outer = radius + thickness / 2;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - center.x;
        const dy = y + 0.5 - center.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= inner && distance <= outer) {
          this.paintDot(x, y, fill);
        }
      }
    }
  }

  blitDots(source: BrailleSurface, position: Point, options: { clip?: Rect } = {}) {
    for (let y = 0; y < source.dotHeight; y += 1) {
      for (let x = 0; x < source.dotWidth; x += 1) {
        const targetPoint = {
          x: position.x + x,
          y: position.y + y
        };

        if (!this.insideDots(targetPoint.x, targetPoint.y)) {
          continue;
        }

        if (options.clip && !pointInRect(targetPoint, options.clip)) {
          continue;
        }

        const dot = source.dotAt(x, y);

        if (!dot) {
          continue;
        }

        this.paintDot(targetPoint.x, targetPoint.y, dot);
      }
    }
  }

  cellAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }

    this.ensureCompiled();
    return cloneCell(this.compiledCells?.[y * this.width + x] ?? null);
  }

  toSurface() {
    return Surface.fromRaster(this);
  }

  toSprite() {
    return Sprite.fromRaster(this);
  }
}
