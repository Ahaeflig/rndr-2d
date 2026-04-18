import { describe, expect, it } from "vitest";

import {
  Surface,
  ansiColor,
  createCell,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  rgbColor
} from "../src/index.js";

describe("ANSI rendering", () => {
  it("serializes styled surfaces", () => {
    const frame = new Surface(2, 1);
    frame.setCell(0, 0, createCell("A", { foreground: ansiColor(196), bold: true }));
    frame.setCell(1, 0, createCell("B", { background: rgbColor(10, 20, 30) }));

    expect(renderSurfaceAnsi(frame)).toBe(
      "\u001b[1;1H\u001b[0m\u001b[1;38;5;196mA\u001b[0m\u001b[48;2;10;20;30mB\u001b[0m\u001b[0m"
    );
  });

  it("emits only changed runs for diff rendering", () => {
    const previous = new Surface(3, 1);
    previous.fill(createCell("."));

    const next = previous.clone();
    next.setCell(1, 0, createCell("@", { foreground: ansiColor(81) }));

    expect(renderSurfaceDiffAnsi(previous, next)).toBe(
      "\u001b[1;2H\u001b[0m\u001b[38;5;81m@\u001b[0m\u001b[0m"
    );
  });
});
