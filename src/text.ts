import type { Cell } from "./cell.js";
import type { Rect } from "./geometry.js";
import { Surface } from "./surface.js";
import type { CellStyle } from "./style.js";

export interface DrawTextBlockInRectInput {
  rect: Rect;
  lines: readonly string[];
  style?: CellStyle | undefined;
  align?: "left" | "center" | "right" | undefined;
  verticalAlign?: "top" | "middle" | "bottom" | undefined;
  fill?: Cell | null | undefined;
}

export interface DrawTextBlockInRowsInput {
  rows: readonly Rect[];
  lines: readonly string[];
  style?: CellStyle | undefined;
  align?: "left" | "center" | "right" | undefined;
  verticalAlign?: "top" | "middle" | "bottom" | undefined;
  fill?: Cell | null | undefined;
}

export function drawTextBlockInRows(surface: Surface, input: DrawTextBlockInRowsInput) {
  const rows = input.rows.filter((row) => row.width > 0 && row.height > 0);

  if (rows.length === 0) {
    return;
  }

  if (input.fill !== undefined) {
    for (const row of rows) {
      surface.fillRect(row, input.fill);
    }
  }

  const visibleLines = input.lines.slice(0, Math.max(1, rows.length));
  const align = input.align ?? "center";
  const verticalAlign = input.verticalAlign ?? "middle";
  const verticalOffset =
    verticalAlign === "top"
      ? 0
      : verticalAlign === "bottom"
        ? Math.max(0, rows.length - visibleLines.length)
        : Math.max(0, Math.floor((rows.length - visibleLines.length) / 2));

  for (let index = 0; index < visibleLines.length; index += 1) {
    const row = rows[verticalOffset + index];

    if (!row) {
      continue;
    }

    const line = (visibleLines[index] ?? "").slice(0, Math.max(1, row.width));
    const x =
      align === "left"
        ? row.x
        : align === "right"
          ? row.x + Math.max(0, row.width - line.length)
          : row.x + Math.max(0, Math.floor((row.width - line.length) / 2));

    surface.drawText(
      {
        x,
        y: row.y + Math.floor((row.height - 1) / 2)
      },
      line,
      input.style
    );
  }
}

export function drawTextBlockInRect(surface: Surface, input: DrawTextBlockInRectInput) {
  const { rect } = input;

  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  drawTextBlockInRows(surface, {
    rows: Array.from({ length: rect.height }, (_value, index) => ({
      x: rect.x,
      y: rect.y + index,
      width: rect.width,
      height: 1
    })),
    lines: input.lines,
    style: input.style,
    align: input.align,
    verticalAlign: input.verticalAlign,
    fill: input.fill
  });
}
