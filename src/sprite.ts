import { cloneCell, createCell, type Cell } from "./cell.js";
import type { RasterSource } from "./raster.js";
import type { CellStyle } from "./style.js";

export interface SpriteTextInput {
  text?: string;
  lines?: readonly string[];
  transparentGlyphs?: readonly string[];
  style?: CellStyle | ((input: { glyph: string; x: number; y: number }) => CellStyle | undefined);
}

export type GlyphRotator = (glyph: string, quarterTurns: number) => string;

const QUARTER_TURN_GLYPH_CW: Record<string, string> = {
  "-": "|",
  "|": "-",
  "/": "\\",
  "\\": "/",
  "<": "^",
  "^": ">",
  ">": "v",
  v: "<",
  "←": "↑",
  "↑": "→",
  "→": "↓",
  "↓": "←",
  "↖": "↗",
  "↗": "↘",
  "↘": "↙",
  "↙": "↖",
  "╱": "╲",
  "╲": "╱"
};

function normalizeQuarterTurns(turns: number) {
  const remainder = turns % 4;
  return remainder < 0 ? remainder + 4 : remainder;
}

export function rotateGlyphQuarterTurns(glyph: string, quarterTurns: number) {
  let rotated = glyph;

  for (let step = 0; step < normalizeQuarterTurns(quarterTurns); step += 1) {
    rotated = QUARTER_TURN_GLYPH_CW[rotated] ?? rotated;
  }

  return rotated;
}

export class Sprite implements RasterSource {
  readonly width: number;
  readonly height: number;
  private readonly cells: (Cell | null)[];

  constructor(width: number, height: number, cells: readonly (Cell | null)[]) {
    if (!Number.isInteger(width) || width < 0) {
      throw new RangeError("Sprite width must be a non-negative integer.");
    }

    if (!Number.isInteger(height) || height < 0) {
      throw new RangeError("Sprite height must be a non-negative integer.");
    }

    if (cells.length !== width * height) {
      throw new Error("Sprite cell count must equal width * height.");
    }

    this.width = width;
    this.height = height;
    this.cells = cells.map((cell) => cloneCell(cell));
  }

  static fromText(input: SpriteTextInput) {
    const lines = input.lines ?? (input.text ? input.text.split(/\r?\n/u) : undefined);

    if (!lines) {
      throw new Error("Sprite.fromText requires either text or lines.");
    }

    const transparentGlyphs = new Set(input.transparentGlyphs ?? [" "]);
    const width = lines.reduce((maxWidth, line) => Math.max(maxWidth, line.length), 0);
    const height = lines.length;
    const cells: (Cell | null)[] = [];

    for (let y = 0; y < height; y += 1) {
      const line = lines[y] ?? "";

      for (let x = 0; x < width; x += 1) {
        const glyph = line[x] ?? " ";

        if (transparentGlyphs.has(glyph)) {
          cells.push(null);
          continue;
        }

        const style =
          typeof input.style === "function" ? input.style({ glyph, x, y }) : input.style;
        cells.push(createCell(glyph, style));
      }
    }

    return new Sprite(width, height, cells);
  }

  static fromRaster(source: RasterSource) {
    const cells: (Cell | null)[] = [];

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        cells.push(cloneCell(source.cellAt(x, y)));
      }
    }

    return new Sprite(source.width, source.height, cells);
  }

  cellAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }

    return this.cells[y * this.width + x] ?? null;
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

  rotateQuarterTurns(
    quarterTurns: number,
    options: { glyphRotator?: GlyphRotator } = {}
  ) {
    const normalizedTurns = normalizeQuarterTurns(quarterTurns);

    if (normalizedTurns === 0) {
      return new Sprite(this.width, this.height, this.cells);
    }

    const nextWidth = normalizedTurns % 2 === 0 ? this.width : this.height;
    const nextHeight = normalizedTurns % 2 === 0 ? this.height : this.width;
    const nextCells = new Array<Cell | null>(nextWidth * nextHeight).fill(null);
    const rotateGlyph = options.glyphRotator ?? rotateGlyphQuarterTurns;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const cell = this.cellAt(x, y);

        if (!cell) {
          continue;
        }

        let nextX = x;
        let nextY = y;

        switch (normalizedTurns) {
          case 1:
            nextX = this.height - 1 - y;
            nextY = x;
            break;
          case 2:
            nextX = this.width - 1 - x;
            nextY = this.height - 1 - y;
            break;
          case 3:
            nextX = y;
            nextY = this.width - 1 - x;
            break;
          default:
            break;
        }

        nextCells[nextY * nextWidth + nextX] = {
          glyph: rotateGlyph(cell.glyph, normalizedTurns),
          ...(cell.style ? { style: { ...cell.style } } : {})
        };
      }
    }

    return new Sprite(nextWidth, nextHeight, nextCells);
  }
}

