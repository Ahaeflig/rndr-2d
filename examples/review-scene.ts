import {
  ansiColor,
  composeScene,
  createCell,
  createHexGridSprite,
  drawHexLabel,
  rgbColor,
  Sprite,
  Surface,
  type CellStyle
} from "../src/index.js";

function unitSprite(color: number, glyph = "@") {
  return Sprite.fromText({
    lines: [" /^\\ ", `<${glyph}${glyph}>`, " \\/ "],
    transparentGlyphs: [" "],
    style: {
      foreground: ansiColor(color),
      bold: true
    }
  });
}

function sparkSprite(style: CellStyle) {
  return Sprite.fromText({
    lines: [" * ", "***", " * "],
    transparentGlyphs: [" "],
    style
  });
}

function makeHudSurface(title: string, summary: readonly string[]) {
  const surface = new Surface(20, 10);
  const border = ansiColor(245);
  const text = ansiColor(255);

  surface.drawText({ x: 0, y: 0 }, "+------------------+", { foreground: border });
  for (let y = 1; y < 9; y += 1) {
    surface.drawText({ x: 0, y }, "|", { foreground: border });
    surface.drawText({ x: 19, y }, "|", { foreground: border });
  }
  surface.drawText({ x: 0, y: 9 }, "+------------------+", { foreground: border });
  surface.drawText({ x: 2, y: 1 }, title, { foreground: text, bold: true });

  for (let index = 0; index < summary.length; index += 1) {
    surface.drawText({ x: 2, y: 3 + index }, summary[index] ?? "", {
      foreground: ansiColor(250)
    });
  }

  return surface;
}

export function buildReviewFrames() {
  const board = createHexGridSprite({
    board: { cols: 5, rows: 4 },
    fill: ({ q, r }) => {
      const value = (q + r) % 3;
      return value === 0 ? "." : value === 1 ? ":" : ";";
    },
    style: ({ q, r }) => ({
      foreground: ansiColor((q + r) % 2 === 0 ? 244 : 240)
    })
  });

  const strikerBase = unitSprite(214, "@");
  const strikerEast = strikerBase.rotateQuarterTurns(1);
  const sentinelBase = unitSprite(81, "#");
  const sentinelSouth = sentinelBase.rotateQuarterTurns(2);
  const spark = sparkSprite({
    foreground: ansiColor(226),
    bold: true
  });
  const blast = sparkSprite({
    foreground: ansiColor(196),
    bold: true
  });

  const frameA = composeScene({
    size: { width: 56, height: 24 },
    background: createCell(" ", {
      background: rgbColor(12, 12, 18)
    }),
    layers: [
      {
        name: "board",
        z: 0,
        items: [{ source: board, position: { x: 1, y: 1 } }]
      },
      {
        name: "effects-under",
        z: 1,
        items: [{ source: spark, position: { x: 15, y: 9 } }]
      },
      {
        name: "units",
        z: 2,
        items: [
          { source: strikerEast, position: { x: 10, y: 7 } },
          { source: sentinelBase, position: { x: 24, y: 11 } }
        ]
      },
      {
        name: "hud",
        z: 3,
        items: [
          {
            source: makeHudSurface("FRAME A", ["scene: stable", "z-layers: 4", "diff target: B"]),
            position: { x: 35, y: 2 }
          }
        ]
      }
    ]
  });

  drawHexLabel(frameA, {
    coord: { q: 1, r: 1 },
    text: "A1",
    style: {
      foreground: ansiColor(15),
      bold: true
    }
  });
  drawHexLabel(frameA, {
    coord: { q: 2, r: 1 },
    text: "B2",
    style: {
      foreground: ansiColor(196),
      bold: true
    }
  });
  drawHexLabel(frameA, {
    coord: { q: 3, r: 2 },
    text: "C3",
    style: {
      foreground: ansiColor(81),
      bold: true
    }
  });

  const frameB = composeScene({
    size: { width: 56, height: 24 },
    background: createCell(" ", {
      background: rgbColor(12, 12, 18)
    }),
    layers: [
      {
        name: "board",
        z: 0,
        items: [{ source: board, position: { x: 1, y: 1 } }]
      },
      {
        name: "effects-under",
        z: 1,
        items: [
          { source: spark, position: { x: 18, y: 9 } },
          { source: blast, position: { x: 26, y: 10 } }
        ]
      },
      {
        name: "units",
        z: 2,
        items: [
          { source: strikerBase, position: { x: 15, y: 8 } },
          { source: sentinelSouth, position: { x: 25, y: 10 } }
        ]
      },
      {
        name: "hud",
        z: 3,
        items: [
          {
            source: makeHudSurface("FRAME B", ["scene: moved", "rotations: yes", "blast overlay: on"]),
            position: { x: 35, y: 2 }
          }
        ]
      }
    ]
  });

  drawHexLabel(frameB, {
    coord: { q: 1, r: 1 },
    text: "A1",
    style: {
      foreground: ansiColor(15),
      bold: true
    }
  });
  drawHexLabel(frameB, {
    coord: { q: 2, r: 1 },
    text: "B2",
    style: {
      foreground: ansiColor(196),
      bold: true
    }
  });
  drawHexLabel(frameB, {
    coord: { q: 3, r: 2 },
    text: "C3",
    style: {
      foreground: ansiColor(81),
      bold: true
    }
  });

  return {
    frameA,
    frameB
  };
}

