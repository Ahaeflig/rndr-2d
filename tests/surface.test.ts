import { describe, expect, it } from "vitest";

import {
  Surface,
  Sprite,
  ansiColor,
  composeScene,
  createCell
} from "../src/index.js";

describe("composeScene", () => {
  it("preserves transparency and layer order", () => {
    const background = new Surface(4, 2);
    background.fill(createCell("."));

    const token = Sprite.fromText({
      lines: [" @ ", "@@@"],
      transparentGlyphs: [" "]
    });

    const frame = composeScene({
      size: { width: 4, height: 2 },
      layers: [
        {
          name: "background",
          z: 0,
          items: [{ source: background, position: { x: 0, y: 0 } }]
        },
        {
          name: "token",
          z: 1,
          items: [
            {
              source: token,
              position: { x: 0, y: 0 },
              style: { foreground: ansiColor(196), bold: true }
            }
          ]
        }
      ]
    });

    expect(frame.toLines()).toEqual([".@..", "@@@."]);
    expect(frame.cellAt(1, 0)?.style).toEqual({
      foreground: ansiColor(196),
      bold: true
    });
  });
});

