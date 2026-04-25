import { cloneCell, createCell, withCellStyle, type Cell } from "./cell.js";
import { pointInRect, type Point, type Rect } from "./geometry.js";
import type { RasterSource } from "./raster.js";
import type { CellStyle } from "./style.js";

export type BlendMode = "over" | "under" | "background";

export interface BlitOptions {
  blendMode?: BlendMode;
  style?: CellStyle;
  clip?: Rect;
}

function assertDimension(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

function insideSurface(width: number, height: number, x: number, y: number) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function isBackgroundOnlyCell(cell: Cell) {
  return (
    cell.glyph === " " &&
    !!cell.style?.background &&
    !cell.style.foreground &&
    !cell.style.bold &&
    !cell.style.dim &&
    !cell.style.italic &&
    !cell.style.underline &&
    !cell.style.inverse
  );
}

export class Surface implements RasterSource {
  readonly width: number;
  readonly height: number;
  private readonly cells: (Cell | null)[];

  constructor(width: number, height: number, fill: Cell | null = null) {
    assertDimension("Surface width", width);
    assertDimension("Surface height", height);
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: width * height }, () => cloneCell(fill));
  }

  static fromRaster(source: RasterSource) {
    const surface = new Surface(source.width, source.height);

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        surface.setCell(x, y, source.cellAt(x, y));
      }
    }

    return surface;
  }

  private index(x: number, y: number) {
    return y * this.width + x;
  }

  clone() {
    return Surface.fromRaster(this);
  }

  clear(fill: Cell | null = null) {
    for (let index = 0; index < this.cells.length; index += 1) {
      this.cells[index] = cloneCell(fill);
    }
  }

  fill(fill: Cell | null) {
    this.clear(fill);
  }

  cellAt(x: number, y: number) {
    if (!insideSurface(this.width, this.height, x, y)) {
      return null;
    }

    return this.cells[this.index(x, y)] ?? null;
  }

  setCell(x: number, y: number, cell: Cell | null) {
    if (!insideSurface(this.width, this.height, x, y)) {
      return;
    }

    this.cells[this.index(x, y)] = cloneCell(cell);
  }

  fillRect(rect: Rect, fill: Cell | null) {
    const startX = Math.max(0, rect.x);
    const startY = Math.max(0, rect.y);
    const endX = Math.min(this.width, rect.x + rect.width);
    const endY = Math.min(this.height, rect.y + rect.height);

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        this.setCell(x, y, fill);
      }
    }
  }

  drawText(position: Point, text: string, style?: CellStyle) {
    if (text.includes("\n")) {
      throw new Error("Surface.drawText only accepts a single line. Use drawTextBlock for multi-line text.");
    }

    for (let index = 0; index < text.length; index += 1) {
      const glyph = text[index] ?? " ";
      this.setCell(position.x + index, position.y, createCell(glyph, style));
    }
  }

  drawTextBlock(position: Point, lines: readonly string[], style?: CellStyle) {
    for (let row = 0; row < lines.length; row += 1) {
      this.drawText({ x: position.x, y: position.y + row }, lines[row] ?? "", style);
    }
  }

  blit(source: RasterSource, position: Point, options: BlitOptions = {}) {
    const blendMode = options.blendMode ?? "over";

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const targetPoint = { x: position.x + x, y: position.y + y };

        if (!insideSurface(this.width, this.height, targetPoint.x, targetPoint.y)) {
          continue;
        }

        if (options.clip && !pointInRect(targetPoint, options.clip)) {
          continue;
        }

        const sourceCell = source.cellAt(x, y);

        if (!sourceCell) {
          continue;
        }

        if (blendMode === "under" && this.cellAt(targetPoint.x, targetPoint.y)) {
          continue;
        }

        const styledSourceCell = options.style ? withCellStyle(sourceCell, options.style) : sourceCell;

        if (blendMode === "background" && isBackgroundOnlyCell(styledSourceCell)) {
          const targetCell = this.cellAt(targetPoint.x, targetPoint.y);
          const background = styledSourceCell.style?.background;

          if (!background) {
            continue;
          }

          this.setCell(
            targetPoint.x,
            targetPoint.y,
            targetCell
              ? createCell(targetCell.glyph, {
                  ...(targetCell.style ?? {}),
                  background
                })
              : styledSourceCell
          );
          continue;
        }

        this.setCell(
          targetPoint.x,
          targetPoint.y,
          styledSourceCell
        );
      }
    }
  }

  toLines(blankGlyph = " ") {
    const lines: string[] = [];

    for (let y = 0; y < this.height; y += 1) {
      let line = "";

      for (let x = 0; x < this.width; x += 1) {
        line += this.cellAt(x, y)?.glyph ?? blankGlyph;
      }

      lines.push(line);
    }

    return lines;
  }
}
