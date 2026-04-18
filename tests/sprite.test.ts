import { describe, expect, it } from "vitest";

import { Sprite } from "../src/index.js";

describe("Sprite.rotateQuarterTurns", () => {
  it("rotates the matrix clockwise and remaps directional glyphs", () => {
    const sprite = Sprite.fromText({
      lines: ["->", "^|"],
      transparentGlyphs: []
    });

    const rotated = sprite.rotateQuarterTurns(1);

    expect(rotated.toLines()).toEqual([">|", "-v"]);
  });
});

