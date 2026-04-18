import { mergeStyle, normalizeStyle, styleEquals, type CellStyle } from "./style.js";

export interface Cell {
  glyph: string;
  style?: CellStyle;
}

export function createCell(glyph: string, style?: CellStyle): Cell {
  if (glyph.length === 0) {
    throw new Error("Cell glyph must not be empty.");
  }

  if (glyph.includes("\n")) {
    throw new Error("Cell glyph must not contain newlines.");
  }

  const normalizedStyle = normalizeStyle(style);
  return normalizedStyle ? { glyph, style: normalizedStyle } : { glyph };
}

export function cloneCell(cell: Cell | null | undefined): Cell | null {
  if (!cell) {
    return null;
  }

  return cell.style ? { glyph: cell.glyph, style: { ...cell.style } } : { glyph: cell.glyph };
}

export function withCellStyle(cell: Cell, style: CellStyle | undefined): Cell {
  const merged = mergeStyle(cell.style, style);
  return merged ? { glyph: cell.glyph, style: merged } : { glyph: cell.glyph };
}

export function cellEquals(a: Cell | null | undefined, b: Cell | null | undefined) {
  if (!a || !b) {
    return a === b;
  }

  return a.glyph === b.glyph && styleEquals(a.style, b.style);
}

