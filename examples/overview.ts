import {
  ansiColor,
  composeScene,
  createCell,
  createHexGridSprite,
  drawHexLabel,
  renderSurfaceAnsi,
  rgbColor,
  Sprite
} from "../src/index.js";

const board = createHexGridSprite({
  board: { cols: 4, rows: 3 },
  fill: ({ q, r }) => ((q + r) % 2 === 0 ? "." : ":"),
  style: {
    foreground: ansiColor(240)
  }
});

const scoutBase = Sprite.fromText({
  lines: [" /^\\ ", "<@@>", " \\/ "],
  transparentGlyphs: [" "],
  style: {
    foreground: ansiColor(214),
    bold: true
  }
});

const scout = scoutBase.rotateQuarterTurns(1);
const frame = composeScene({
  size: { width: 34, height: 18 },
  background: createCell(" ", {
    background: rgbColor(12, 12, 18)
  }),
  layers: [
    {
      name: "board",
      z: 0,
      items: [
        {
          source: board,
          position: { x: 0, y: 0 }
        }
      ]
    },
    {
      name: "units",
      z: 1,
      items: [
        {
          source: scout,
          position: { x: 9, y: 5 }
        },
        {
          source: scoutBase,
          position: { x: 16, y: 8 },
          style: {
            foreground: ansiColor(81)
          }
        }
      ]
    }
  ]
});

drawHexLabel(frame, {
  coord: { q: 1, r: 1 },
  text: "A1",
  style: {
    foreground: ansiColor(15),
    bold: true
  }
});

drawHexLabel(frame, {
  coord: { q: 2, r: 1 },
  text: "B2",
  style: {
    foreground: ansiColor(196),
    bold: true
  }
});

process.stdout.write(renderSurfaceAnsi(frame));
process.stdout.write("\n");

