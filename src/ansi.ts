import { cellEquals, type Cell } from "./cell.js";
import type { Point } from "./geometry.js";
import type { RasterSource } from "./raster.js";
import { styleEquals, styleToAnsiCodes, type CellStyle } from "./style.js";

const ESC = "\x1b";

export const ANSI_RESET = `${ESC}[0m`;

export interface AnsiRenderOptions {
  origin?: Point;
  resetAtEnd?: boolean;
  hideCursor?: boolean;
  showCursor?: boolean;
}

function normalizeCell(cell: Cell | null) {
  return cell ?? null;
}

function emitCell(cell: Cell | null, currentStyle: CellStyle | undefined) {
  const nextStyle = cell?.style;
  let output = "";

  if (!styleEquals(currentStyle, nextStyle)) {
    output += ANSI_RESET;
    const codes = styleToAnsiCodes(nextStyle);

    if (codes.length > 0) {
      output += `${ESC}[${codes.join(";")}m`;
    }
  }

  output += cell?.glyph ?? " ";
  return {
    output,
    style: nextStyle
  };
}

function renderRun(
  source: RasterSource,
  y: number,
  startX: number,
  endX: number,
  origin: Point
) {
  let output = cursorTo({ x: origin.x + startX, y: origin.y + y });
  let currentStyle: CellStyle | undefined;

  for (let x = startX; x < endX; x += 1) {
    const emitted = emitCell(normalizeCell(source.cellAt(x, y)), currentStyle);
    output += emitted.output;
    currentStyle = emitted.style;
  }

  if (!styleEquals(currentStyle, undefined)) {
    output += ANSI_RESET;
  }

  return output;
}

export function cursorTo(point: Point) {
  return `${ESC}[${point.y + 1};${point.x + 1}H`;
}

export function clearScreen() {
  return `${ESC}[2J`;
}

export function enterAltScreen() {
  return `${ESC}[?1049h`;
}

export function leaveAltScreen() {
  return `${ESC}[?1049l`;
}

export function hideTerminalCursor() {
  return `${ESC}[?25l`;
}

export function showTerminalCursor() {
  return `${ESC}[?25h`;
}

export function renderSurfaceAnsi(
  source: RasterSource,
  options: AnsiRenderOptions = {}
) {
  const origin = options.origin ?? { x: 0, y: 0 };
  let output = "";

  if (options.hideCursor) {
    output += hideTerminalCursor();
  }

  for (let y = 0; y < source.height; y += 1) {
    output += renderRun(source, y, 0, source.width, origin);
  }

  if (options.resetAtEnd ?? true) {
    output += ANSI_RESET;
  }

  if (options.showCursor) {
    output += showTerminalCursor();
  }

  return output;
}

export function renderSurfaceDiffAnsi(
  previous: RasterSource | null,
  next: RasterSource,
  options: AnsiRenderOptions = {}
) {
  if (!previous || previous.width !== next.width || previous.height !== next.height) {
    return renderSurfaceAnsi(next, options);
  }

  const origin = options.origin ?? { x: 0, y: 0 };
  let output = "";

  if (options.hideCursor) {
    output += hideTerminalCursor();
  }

  for (let y = 0; y < next.height; y += 1) {
    let x = 0;

    while (x < next.width) {
      if (cellEquals(previous.cellAt(x, y), next.cellAt(x, y))) {
        x += 1;
        continue;
      }

      const startX = x;

      while (x < next.width && !cellEquals(previous.cellAt(x, y), next.cellAt(x, y))) {
        x += 1;
      }

      output += renderRun(next, y, startX, x, origin);
    }
  }

  if (options.resetAtEnd ?? true) {
    output += ANSI_RESET;
  }

  if (options.showCursor) {
    output += showTerminalCursor();
  }

  return output;
}

