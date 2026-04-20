import { describe, expect, it } from "vitest";

import {
  BrailleSurface,
  Sprite,
  ansiColor,
  brailleCellSizeFromDotSize,
  brailleDotPointFromCell,
  brailleDotRectFromCellRect,
  composeScene,
  rgbColor
} from "../src/index.js";

describe("BrailleSurface", () => {
  it("maps braille dots into Unicode braille cells", () => {
    const braille = new BrailleSurface(1, 1);
    braille.setDot(0, 0);
    braille.setDot(1, 3);

    expect(braille.cellAt(0, 0)?.glyph).toBe("⢁");
  });

  it("averages rgb foreground colors across active dots", () => {
    const braille = new BrailleSurface(1, 1, {
      activationThreshold: 0.2
    });
    braille.paintDot(0, 0, {
      value: 1,
      style: {
        foreground: rgbColor(255, 0, 0)
      }
    });
    braille.paintDot(1, 0, {
      value: 1,
      style: {
        foreground: rgbColor(0, 0, 255)
      }
    });

    expect(braille.cellAt(0, 0)?.style?.foreground).toEqual(rgbColor(128, 0, 128));
  });

  it("supports polygon fill and line drawing in micro-dot space", () => {
    const braille = BrailleSurface.fromDotSize(8, 8);
    braille.fillPolygon(
      [
        { x: 1, y: 1 },
        { x: 6, y: 1 },
        { x: 4, y: 6 },
        { x: 1, y: 5 }
      ],
      {
        style: {
          foreground: ansiColor(81)
        }
      }
    );
    braille.drawDotLine({ x: 0, y: 7 }, { x: 7, y: 0 }, {
      style: {
        foreground: ansiColor(196),
        bold: true
      }
    });

    expect(braille.toSurface().toLines()).toEqual(["⢰⣶⡶⠊", "⡨⠛⠁ "]);
  });

  it("composes into scenes like any other raster source", () => {
    const braille = new BrailleSurface(2, 1);
    braille.fillCircle({ x: 1.5, y: 1.5 }, 1.2, {
      style: {
        foreground: ansiColor(226),
        bold: true
      }
    });
    const label = Sprite.fromText({
      lines: ["OK"],
      transparentGlyphs: [],
      style: {
        foreground: ansiColor(15)
      }
    });

    const frame = composeScene({
      size: { width: 2, height: 1 },
      layers: [
        {
          name: "braille",
          z: 0,
          items: [{ source: braille, position: { x: 0, y: 0 } }]
        },
        {
          name: "label",
          z: 1,
          items: [{ source: label, position: { x: 0, y: 0 } }]
        }
      ]
    });

    expect(frame.toLines()).toEqual(["OK"]);
    expect(frame.cellAt(0, 0)?.style?.foreground).toEqual(ansiColor(15));
  });

  it("converts micro-dot sizes into cell sizes", () => {
    expect(brailleCellSizeFromDotSize({ width: 9, height: 9 })).toEqual({
      width: 5,
      height: 3
    });
  });

  it("maps cell coordinates into braille dot coordinates", () => {
    expect(brailleDotPointFromCell({ x: 3, y: 2 })).toEqual({
      x: 6,
      y: 8
    });
    expect(brailleDotPointFromCell({ x: 3, y: 2 }, "center")).toEqual({
      x: 6.5,
      y: 9.5
    });
    expect(
      brailleDotRectFromCellRect({ x: 2, y: 1, width: 3, height: 2 })
    ).toEqual({
      x: 4,
      y: 4,
      width: 6,
      height: 8
    });
  });

  it("supports drawing in cell space for consumer code", () => {
    const braille = new BrailleSurface(4, 2, {
      activationThreshold: 0.2
    });

    braille.paintCell(0, 0, {
      value: 1,
      style: {
        foreground: ansiColor(226)
      }
    });
    braille.fillCellRect(
      {
        x: 1,
        y: 0,
        width: 3,
        height: 1
      },
      {
        value: 1,
        style: {
          foreground: ansiColor(81)
        }
      }
    );
    braille.drawCellLine(
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      {
        value: 1,
        style: {
          foreground: ansiColor(196),
          bold: true
        }
      }
    );

    expect(braille.toSurface().toLines()).toEqual(["⣿⣿⣿⣿", "⠠⠤⠤⠤"]);
    expect(braille.cellAt(0, 0)?.style?.foreground).toEqual(ansiColor(226));
  });
});
