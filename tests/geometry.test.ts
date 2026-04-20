import { describe, expect, it } from "vitest";

import { plotLinePoints, pointInPolygon } from "../src/index.js";

describe("plotLinePoints", () => {
  it("includes both endpoints on a horizontal line", () => {
    expect(plotLinePoints({ x: 2, y: 4 }, { x: 5, y: 4 })).toEqual([
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 }
    ]);
  });

  it("handles steep lines without skipping the final point", () => {
    expect(plotLinePoints({ x: 1, y: 1 }, { x: 3, y: 6 })).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 5 },
      { x: 3, y: 6 }
    ]);
  });

  it("rasterizes shallow lines into adjacent terminal cells", () => {
    expect(plotLinePoints({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 2 },
      { x: 4, y: 2 }
    ]);
  });

  it("classifies points inside a polygon", () => {
    const polygon = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 3 },
      { x: 3, y: 5 },
      { x: 1, y: 4 }
    ];

    expect(pointInPolygon({ x: 3, y: 3 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 0, y: 0 }, polygon)).toBe(false);
  });
});
