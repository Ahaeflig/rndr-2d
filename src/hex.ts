import { createCell } from "./cell.js";
import type { Point, Rect, Size } from "./geometry.js";
import { Sprite } from "./sprite.js";
import { Surface } from "./surface.js";
import { mergeStyle } from "./style.js";
import type { CellStyle } from "./style.js";
import type { Cell } from "./cell.js";
import { drawTextBlockInRows } from "./text.js";

export interface AxialCoord {
  q: number;
  r: number;
}

export interface HexBoardSize {
  cols: number;
  rows: number;
}

export const HEX_FACINGS = ["n", "ne", "se", "s", "sw", "nw"] as const;

export type HexFacing = (typeof HEX_FACINGS)[number];

export const HEX_FACING_NAMES = ["north", "northEast", "southEast", "south", "southWest", "northWest"] as const;

export type HexFacingName = (typeof HEX_FACING_NAMES)[number];

export type HexFacingLike = HexFacing | HexFacingName;

export type HexFacingMap<T> = Record<HexFacing, T>;

export type HexFacingSpriteSet = HexFacingMap<Sprite>;

export const HEX_FACING_NAME_BY_ID: Record<HexFacing, HexFacingName> = {
  n: "north",
  ne: "northEast",
  se: "southEast",
  s: "south",
  sw: "southWest",
  nw: "northWest"
};

export const HEX_FACING_ID_BY_NAME: Record<HexFacingName, HexFacing> = {
  north: "n",
  northEast: "ne",
  southEast: "se",
  south: "s",
  southWest: "sw",
  northWest: "nw"
};

export interface HexTileTemplate {
  rows: readonly string[];
  fillGlyph?: string;
  contentAnchor: Point;
  contentBox?: Rect;
}

export interface HexLayout {
  name: string;
  template: HexTileTemplate;
  colStep: number;
  rowStep: number;
  rowSkew: number;
  family?: "pointy-hex";
  scale?: number;
  baseName?: string;
}

export const DEFAULT_HEX_TILE_TEMPLATE: HexTileTemplate = {
  rows: ["  ____  ", " /....\\ ", "/......\\", "\\....../", " \\____/ "],
  fillGlyph: ".",
  contentAnchor: { x: 3, y: 2 },
  contentBox: {
    x: 2,
    y: 1,
    width: 4,
    height: 3
  }
};

export const DEFAULT_HEX_LAYOUT: HexLayout = {
  name: "default",
  template: DEFAULT_HEX_TILE_TEMPLATE,
  colStep: 6,
  rowStep: 4,
  rowSkew: 2,
  family: "pointy-hex",
  scale: 1,
  baseName: "default"
};

function facingVector(layout: HexLayout, facing: HexFacing): Point {
  switch (facing) {
    case "n":
      return { x: 0, y: -layout.rowStep };
    case "ne":
      return { x: layout.colStep, y: -layout.rowSkew };
    case "se":
      return { x: layout.colStep, y: layout.rowSkew };
    case "s":
      return { x: 0, y: layout.rowStep };
    case "sw":
      return { x: -layout.colStep, y: layout.rowSkew };
    case "nw":
      return { x: -layout.colStep, y: -layout.rowSkew };
    default:
      return { x: 0, y: -layout.rowStep };
  }
}

function isHexFacing(value: string): value is HexFacing {
  return (HEX_FACINGS as readonly string[]).includes(value);
}

function isHexFacingName(value: string): value is HexFacingName {
  return (HEX_FACING_NAMES as readonly string[]).includes(value);
}

function assertBoardSize(board: HexBoardSize) {
  if (!Number.isInteger(board.cols) || board.cols <= 0) {
    throw new RangeError("Hex board cols must be a positive integer.");
  }

  if (!Number.isInteger(board.rows) || board.rows <= 0) {
    throw new RangeError("Hex board rows must be a positive integer.");
  }
}

function tileSize(layout: HexLayout) {
  return {
    width: layout.template.rows[0]?.length ?? 0,
    height: layout.template.rows.length
  };
}

function normalizeFillGlyph(fillGlyph: string) {
  if (fillGlyph.length !== 1) {
    throw new Error("Hex fill glyphs must be exactly one character wide.");
  }

  return fillGlyph;
}

function normalizeScale(scale: number) {
  if (!Number.isInteger(scale) || scale <= 0) {
    throw new RangeError("Hex layout scale must be a positive integer.");
  }

  return scale;
}

function repeatText(text: string, scale: number) {
  return [...text].map((glyph) => glyph.repeat(scale)).join("");
}

function cloneLayout(layout: HexLayout): HexLayout {
  return {
    ...layout,
    template: {
      ...layout.template,
      ...(layout.template.contentBox ? { contentBox: { ...layout.template.contentBox } } : {}),
      contentAnchor: { ...layout.template.contentAnchor },
      rows: [...layout.template.rows]
    }
  };
}

function createPointyHexTemplate(scale: number, fillGlyph = DEFAULT_HEX_TILE_TEMPLATE.fillGlyph ?? "."): HexTileTemplate {
  const width = 8 * scale;
  const topInset = 2 * scale;
  const rows = [
    `${" ".repeat(topInset)}${"_".repeat(4 * scale)}${" ".repeat(topInset)}`
  ];

  for (let lead = 2 * scale - 1; lead >= 0; lead -= 1) {
    const fillWidth = width - 2 * lead - 2;
    rows.push(`${" ".repeat(lead)}/${fillGlyph.repeat(fillWidth)}\\${" ".repeat(lead)}`);
  }

  for (let lead = 0; lead <= 2 * scale - 2; lead += 1) {
    const fillWidth = width - 2 * lead - 2;
    rows.push(`${" ".repeat(lead)}\\${fillGlyph.repeat(fillWidth)}/${" ".repeat(lead)}`);
  }

  const contentBox = {
    x: 2 * scale,
    y: scale,
    width: 4 * scale,
    height: 3 * scale
  };

  rows.push(
    `${" ".repeat(Math.max(0, topInset - 1))}\\${"_".repeat(4 * scale)}/${" ".repeat(Math.max(0, topInset - 1))}`
  );

  return {
    rows,
    fillGlyph,
    contentAnchor: {
      x: contentBox.x + Math.floor((contentBox.width - 1) / 2),
      y: contentBox.y + Math.floor((contentBox.height - 1) / 2)
    },
    contentBox
  };
}

function createPointyHexLayout(baseName: string, scale: number, fillGlyph = DEFAULT_HEX_TILE_TEMPLATE.fillGlyph ?? "."): HexLayout {
  return {
    name: scale === 1 ? baseName : `${baseName}-${scale}x`,
    baseName,
    family: "pointy-hex",
    scale,
    template: createPointyHexTemplate(scale, fillGlyph),
    colStep: 6 * scale,
    rowStep: 4 * scale,
    rowSkew: 2 * scale
  };
}

function resolveContentBox(layout: HexLayout): Rect {
  return (
    layout.template.contentBox ?? {
      x: layout.template.contentAnchor.x,
      y: layout.template.contentAnchor.y,
      width: 1,
      height: 1
    }
  );
}

function isInteriorBoundaryGlyph(glyph: string) {
  return glyph === "/" || glyph === "\\" || glyph === "|";
}

function resolveContentRows(layout: HexLayout): Rect[] {
  const rows: Rect[] = [];

  for (let rowIndex = 0; rowIndex < layout.template.rows.length; rowIndex += 1) {
    const row = layout.template.rows[rowIndex] ?? "";
    const first = row.search(/[^ ]/u);

    if (first < 0) {
      continue;
    }

    const last = row.length - 1 - [...row].reverse().join("").search(/[^ ]/u);

    if (last <= first) {
      continue;
    }

    const leftGlyph = row[first] ?? "";
    const rightGlyph = row[last] ?? "";

    if (!isInteriorBoundaryGlyph(leftGlyph) || !isInteriorBoundaryGlyph(rightGlyph)) {
      continue;
    }

    const interior = row.slice(first + 1, last);

    if (/^_+$/u.test(interior)) {
      continue;
    }

    rows.push({
      x: first + 1,
      y: rowIndex,
      width: last - first - 1,
      height: 1
    });
  }

  if (rows.length > 0) {
    return rows;
  }

  return [resolveContentBox(layout)];
}

function paintTile(
  surface: Surface,
  origin: Point,
  layout: HexLayout,
  fillGlyph: string,
  styles: {
    base?: CellStyle;
    fill?: CellStyle;
    border?: CellStyle;
  } = {}
) {
  const placeholder = layout.template.fillGlyph ?? ".";

  for (let rowIndex = 0; rowIndex < layout.template.rows.length; rowIndex += 1) {
    const row = layout.template.rows[rowIndex] ?? "";
    const paintedRow = row.replaceAll(placeholder, fillGlyph);

    for (let columnIndex = 0; columnIndex < paintedRow.length; columnIndex += 1) {
      const glyph = paintedRow[columnIndex] ?? " ";
      const sourceGlyph = row[columnIndex] ?? " ";

      if (glyph === " ") {
        continue;
      }

      const style = mergeStyle(
        styles.base,
        sourceGlyph === placeholder ? styles.fill : styles.border
      );

      surface.setCell(
        origin.x + columnIndex,
        origin.y + rowIndex,
        createCell(glyph, style)
      );
    }
  }
}

export function projectHexOrigin(layout: HexLayout, coord: AxialCoord): Point {
  return {
    x: coord.q * layout.colStep,
    y: coord.r * layout.rowStep + (Math.abs(coord.q) % 2) * layout.rowSkew
  };
}

export function projectHexCenter(layout: HexLayout, coord: AxialCoord): Point {
  const origin = projectHexOrigin(layout, coord);
  return {
    x: origin.x + layout.template.contentAnchor.x,
    y: origin.y + layout.template.contentAnchor.y
  };
}

export function projectHexContentBox(layout: HexLayout, coord: AxialCoord): Rect {
  const origin = projectHexOrigin(layout, coord);
  const contentBox = resolveContentBox(layout);

  return {
    x: origin.x + contentBox.x,
    y: origin.y + contentBox.y,
    width: contentBox.width,
    height: contentBox.height
  };
}

export function projectHexContentRows(layout: HexLayout, coord: AxialCoord): Rect[] {
  const origin = projectHexOrigin(layout, coord);

  return resolveContentRows(layout).map((row) => ({
    x: origin.x + row.x,
    y: origin.y + row.y,
    width: row.width,
    height: row.height
  }));
}

export function scaleHexLayout(layout: HexLayout, scale: number): HexLayout {
  const normalizedScale = normalizeScale(scale);

  if (layout.family === "pointy-hex") {
    return createPointyHexLayout(
      layout.baseName ?? layout.name,
      (layout.scale ?? 1) * normalizedScale,
      layout.template.fillGlyph ?? DEFAULT_HEX_TILE_TEMPLATE.fillGlyph ?? "."
    );
  }

  if (normalizedScale === 1) {
    return cloneLayout(layout);
  }

  const scaledRows: string[] = [];

  for (const row of layout.template.rows) {
    const scaledRow = repeatText(row, normalizedScale);

    for (let repeat = 0; repeat < normalizedScale; repeat += 1) {
      scaledRows.push(scaledRow);
    }
  }

  return {
    ...layout,
    name: `${layout.name}-${normalizedScale}x`,
    scale: (layout.scale ?? 1) * normalizedScale,
    colStep: layout.colStep * normalizedScale,
    rowStep: layout.rowStep * normalizedScale,
    rowSkew: layout.rowSkew * normalizedScale,
    template: {
      rows: scaledRows,
      ...(layout.template.fillGlyph ? { fillGlyph: layout.template.fillGlyph } : {}),
      contentAnchor: {
        x: layout.template.contentAnchor.x * normalizedScale,
        y: layout.template.contentAnchor.y * normalizedScale
      },
      ...(layout.template.contentBox
        ? {
            contentBox: {
              x: layout.template.contentBox.x * normalizedScale,
              y: layout.template.contentBox.y * normalizedScale,
              width: layout.template.contentBox.width * normalizedScale,
              height: layout.template.contentBox.height * normalizedScale
            }
          }
        : {})
    }
  };
}

export function normalizeHexFacing(facing: HexFacingLike): HexFacing {
  if (isHexFacing(facing)) {
    return facing;
  }

  if (isHexFacingName(facing)) {
    return HEX_FACING_ID_BY_NAME[facing];
  }

  throw new Error(`Unknown hex facing: ${String(facing)}`);
}

export function hexFacingName(facing: HexFacingLike): HexFacingName {
  return HEX_FACING_NAME_BY_ID[normalizeHexFacing(facing)];
}

export function hexFacingVector(
  layout: HexLayout = DEFAULT_HEX_LAYOUT,
  facing: HexFacingLike
): Point {
  return facingVector(layout, normalizeHexFacing(facing));
}

export function mapHexFacings<T>(build: (facing: HexFacing, index: number) => T): HexFacingMap<T> {
  return Object.fromEntries(
    HEX_FACINGS.map((facing, index) => [facing, build(facing, index)])
  ) as HexFacingMap<T>;
}

export function createHexFacingSpriteSet(
  build: (facing: HexFacing, index: number) => Sprite
): HexFacingSpriteSet {
  return mapHexFacings(build);
}

export function getHexFacingValue<T>(map: HexFacingMap<T>, facing: HexFacingLike): T {
  return map[normalizeHexFacing(facing)];
}

export function getHexFacingSprite(set: HexFacingSpriteSet, facing: HexFacingLike) {
  return getHexFacingValue(set, facing);
}

export function rotateHexFacing(facing: HexFacingLike, steps: number) {
  const normalizedFacing = normalizeHexFacing(facing);
  const index = HEX_FACINGS.indexOf(normalizedFacing);

  if (index < 0) {
    throw new Error(`Unknown hex facing: ${String(facing)}`);
  }

  const remainder = steps % HEX_FACINGS.length;
  const normalized = remainder < 0 ? remainder + HEX_FACINGS.length : remainder;
  return HEX_FACINGS[(index + normalized) % HEX_FACINGS.length] ?? HEX_FACINGS[0];
}

export function hexFacingFromScreenDelta(input: {
  dx: number;
  dy: number;
  layout?: HexLayout;
  fallback?: HexFacingLike;
}) {
  const layout = input.layout ?? DEFAULT_HEX_LAYOUT;
  const fallback = normalizeHexFacing(input.fallback ?? "n");

  if (input.dx === 0 && input.dy === 0) {
    return fallback;
  }

  let bestFacing = fallback;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const facing of HEX_FACINGS) {
    const vector = hexFacingVector(layout, facing);
    const score = input.dx * vector.x + input.dy * vector.y;

    if (score > bestScore) {
      bestFacing = facing;
      bestScore = score;
    }
  }

  return bestFacing;
}

export function hexBoardSize(board: HexBoardSize, layout: HexLayout = DEFAULT_HEX_LAYOUT): Size {
  assertBoardSize(board);
  const size = tileSize(layout);
  const maxColumnSkew = board.cols > 1 ? layout.rowSkew : 0;

  return {
    width: Math.max(1, (board.cols - 1) * layout.colStep + size.width),
    height: Math.max(1, (board.rows - 1) * layout.rowStep + maxColumnSkew + size.height)
  };
}

export function createHexGridSprite(input: {
  board: HexBoardSize;
  layout?: HexLayout;
  fill?: string | ((coord: AxialCoord) => string);
  style?: CellStyle | ((coord: AxialCoord) => CellStyle | undefined);
  fillStyle?: CellStyle | ((coord: AxialCoord) => CellStyle | undefined);
  borderStyle?: CellStyle | ((coord: AxialCoord) => CellStyle | undefined);
}) {
  const layout = input.layout ?? DEFAULT_HEX_LAYOUT;
  const size = hexBoardSize(input.board, layout);
  const surface = new Surface(size.width, size.height);

  for (let q = 0; q < input.board.cols; q += 1) {
    for (let r = 0; r < input.board.rows; r += 1) {
      const coord = { q, r };
      const fillGlyph = normalizeFillGlyph(
        typeof input.fill === "function" ? input.fill(coord) : input.fill ?? "."
      );
      const style = typeof input.style === "function" ? input.style(coord) : input.style;
      const fillStyle = typeof input.fillStyle === "function" ? input.fillStyle(coord) : input.fillStyle;
      const borderStyle = typeof input.borderStyle === "function" ? input.borderStyle(coord) : input.borderStyle;
      paintTile(surface, projectHexOrigin(layout, coord), layout, fillGlyph, {
        ...(style ? { base: style } : {}),
        ...(fillStyle ? { fill: fillStyle } : {}),
        ...(borderStyle ? { border: borderStyle } : {})
      });
    }
  }

  return Sprite.fromRaster(surface);
}

export function drawHexLabel(surface: Surface, input: {
  coord: AxialCoord;
  text: string;
  layout?: HexLayout;
  style?: CellStyle;
}) {
  const layout = input.layout ?? DEFAULT_HEX_LAYOUT;
  drawTextBlockInRows(surface, {
    rows: projectHexContentRows(layout, input.coord),
    lines: [input.text],
    style: input.style
  });
}

export function drawHexTextBlock(surface: Surface, input: {
  coord: AxialCoord;
  lines: readonly string[];
  layout?: HexLayout;
  style?: CellStyle;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  fill?: Cell | null;
}) {
  const layout = input.layout ?? DEFAULT_HEX_LAYOUT;
  drawTextBlockInRows(surface, {
    rows: projectHexContentRows(layout, input.coord),
    lines: input.lines,
    style: input.style,
    align: input.align,
    verticalAlign: input.verticalAlign,
    fill: input.fill
  });
}
