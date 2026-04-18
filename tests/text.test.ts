import { describe, expect, it } from "vitest";

import {
  Surface,
  createCell,
  drawTextBlockInRect
} from "../src/index.js";

describe("text helpers", () => {
  it("draws aligned text inside a filled rectangle", () => {
    const surface = new Surface(10, 6);

    drawTextBlockInRect(surface, {
      rect: { x: 1, y: 1, width: 6, height: 4 },
      lines: ["ABCD", "Z"],
      align: "right",
      verticalAlign: "bottom",
      fill: createCell(".")
    });

    expect(surface.cellAt(1, 1)?.glyph).toBe(".");
    expect(surface.cellAt(3, 3)?.glyph).toBe("A");
    expect(surface.cellAt(6, 3)?.glyph).toBe("D");
    expect(surface.cellAt(6, 4)?.glyph).toBe("Z");
  });
});
