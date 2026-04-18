import { describe, expect, it } from "vitest";

import {
  Surface,
  ansiColor,
  createCell,
  renderSurfaceWithAxes,
  summarizeSurface,
  summarizeSurfaceDiff,
  visualizeAnsi
} from "../src/index.js";

describe("debug helpers", () => {
  it("summarizes occupied cells and styles", () => {
    const surface = new Surface(3, 2);
    surface.setCell(1, 0, createCell("@", { foreground: ansiColor(81) }));
    surface.setCell(2, 1, createCell("#"));

    expect(summarizeSurface(surface)).toEqual({
      width: 3,
      height: 2,
      nonEmptyCellCount: 2,
      blankGlyphCellCount: 0,
      nonBlankGlyphCellCount: 2,
      styledCellCount: 1,
      uniqueGlyphCount: 2,
      uniqueGlyphs: ["#", "@"],
      occupiedBounds: {
        minX: 1,
        minY: 0,
        maxX: 2,
        maxY: 1
      }
    });
  });

  it("computes diff runs and renders axes", () => {
    const previous = new Surface(4, 2);
    previous.fill(createCell("."));

    const next = previous.clone();
    next.setCell(1, 0, createCell("@"));
    next.setCell(2, 0, createCell("@"));
    next.setCell(0, 1, createCell("#"));

    expect(summarizeSurfaceDiff(previous, next)).toEqual({
      dimensionChanged: false,
      changedCellCount: 3,
      changedRunCount: 2
    });

    expect(renderSurfaceWithAxes(next)).toBe("   0000\n   0123\n00 .@@.\n01 #...");
  });

  it("visualizes ANSI escapes for review", () => {
    expect(visualizeAnsi("\u001b[31mA\u001b[0m")).toBe("^[[31mA^[[0m");
  });
});
