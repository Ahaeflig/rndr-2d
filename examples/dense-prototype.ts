import {
  BrailleSurface,
  Surface,
  createCell,
  renderSurfaceAnsi,
  rgbColor
} from "../src/index.js";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const CELL_WIDTH = 32;
const CELL_HEIGHT = 12;
const FRAME_WIDTH = 76;
const FRAME_HEIGHT = 19;
const BACKGROUND = rgbColor(6, 8, 14);
const SHADE_GLYPHS = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"] as const;

function coarseSurfaceFromBraille(source: BrailleSurface) {
  const surface = new Surface(source.width, source.height);

  for (let cellY = 0; cellY < source.height; cellY += 1) {
    for (let cellX = 0; cellX < source.width; cellX += 1) {
      let activeDots = 0;
      let weightedR = 0;
      let weightedG = 0;
      let weightedB = 0;
      let totalWeight = 0;

      for (let localY = 0; localY < 4; localY += 1) {
        for (let localX = 0; localX < 2; localX += 1) {
          const dot = source.dotAt(cellX * 2 + localX, cellY * 4 + localY);

          if (!dot || dot.value < source.activationThreshold) {
            continue;
          }

          activeDots += 1;
          const foreground = dot.style?.foreground;

          if (foreground?.kind === "rgb") {
            weightedR += foreground.r * dot.value;
            weightedG += foreground.g * dot.value;
            weightedB += foreground.b * dot.value;
            totalWeight += dot.value;
          }
        }
      }

      if (activeDots === 0) {
        continue;
      }

      const density = activeDots / 8;
      const glyphIndex = Math.min(
        SHADE_GLYPHS.length - 1,
        Math.floor(density * (SHADE_GLYPHS.length - 1) + 0.35)
      );
      const glyph = SHADE_GLYPHS[glyphIndex] ?? " ";

      if (glyph === " ") {
        continue;
      }

      surface.setCell(
        cellX,
        cellY,
        createCell(glyph, totalWeight > 0 ? {
          foreground: rgbColor(
            Math.round(weightedR / totalWeight),
            Math.round(weightedG / totalWeight),
            Math.round(weightedB / totalWeight)
          )
        } : undefined)
      );
    }
  }

  return surface;
}

function createDenseExperimentScene() {
  const braille = new BrailleSurface(CELL_WIDTH, CELL_HEIGHT, {
    activationThreshold: 0.22
  });
  const hex = [
    { x: 14, y: 4 },
    { x: 49, y: 4 },
    { x: 61, y: 24 },
    { x: 49, y: 43 },
    { x: 14, y: 43 },
    { x: 2, y: 24 }
  ] as const;
  const ship = [
    { x: 34, y: 24 },
    { x: 40, y: 19 },
    { x: 47, y: 19 },
    { x: 54, y: 24 },
    { x: 47, y: 29 },
    { x: 40, y: 29 }
  ] as const;
  const cockpit = [
    { x: 40, y: 22 },
    { x: 45, y: 24 },
    { x: 40, y: 26 }
  ] as const;

  braille.strokePolygon(hex, {
    style: {
      foreground: rgbColor(126, 221, 243)
    }
  });
  braille.fillPolygon(ship, {
    style: {
      foreground: rgbColor(242, 246, 255)
    }
  });
  braille.fillPolygon(cockpit, {
    style: {
      foreground: rgbColor(130, 223, 255)
    }
  });
  braille.strokeCircle({ x: 17, y: 15 }, 5.8, {
    style: {
      foreground: rgbColor(255, 215, 84)
    }
  }, 1.6);
  braille.fillCircle({ x: 17, y: 15 }, 1.3, {
    value: 0.8,
    style: {
      foreground: rgbColor(255, 236, 147)
    }
  });
  braille.drawDotLine({ x: 22, y: 17 }, { x: 39, y: 23 }, {
    value: 0.85,
    style: {
      foreground: rgbColor(255, 196, 94)
    }
  });

  for (let y = 0; y < braille.dotHeight; y += 1) {
    for (let x = 0; x < braille.dotWidth; x += 1) {
      if ((x * 17 + y * 31 + x * y * 7) % 29 === 0) {
        braille.paintDot(x, y, {
          value: 0.34,
          style: {
            foreground: rgbColor(52, 90, 112)
          }
        });
      }

      const ridgeY =
        31 +
        Math.sin((x - 10) * 0.22) * 3.8 +
        Math.sin((x + 4) * 0.08) * 1.9;

      if (x >= 12 && x <= 53 && Math.abs((y + 0.5) - ridgeY) <= 0.9) {
        braille.paintDot(x, y, {
          value: 0.95,
          style: {
            foreground: rgbColor(126, 215, 123)
          }
        });
      }
    }
  }

  braille.strokePolygon(hex, {
    style: {
      foreground: rgbColor(126, 221, 243)
    }
  });

  return braille;
}

function drawPanelFrame(surface: Surface, x: number, y: number, width: number, height: number) {
  const frameStyle = { foreground: rgbColor(95, 104, 128) };

  surface.drawText({ x, y }, `+${"-".repeat(width - 2)}+`, frameStyle);

  for (let row = 1; row < height - 1; row += 1) {
    surface.drawText({ x, y: y + row }, "|", frameStyle);
    surface.drawText({ x: x + width - 1, y: y + row }, "|", frameStyle);
  }

  surface.drawText({ x, y: y + height - 1 }, `+${"-".repeat(width - 2)}+`, frameStyle);
}

function buildFrame() {
  const frame = new Surface(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    createCell(" ", { background: BACKGROUND })
  );
  const dense = createDenseExperimentScene();
  const coarse = coarseSurfaceFromBraille(dense);

  frame.drawText({ x: 2, y: 1 }, "rndr-2d dense rendering experiment", {
    foreground: rgbColor(244, 246, 250),
    bold: true
  });
  frame.drawText({ x: 2, y: 2 }, "same 32x12 terminal footprint, rendered from the same scene", {
    foreground: rgbColor(154, 165, 185)
  });
  frame.drawText({ x: 2, y: 3 }, "left: coarse density chars   right: BrailleSurface micro-dots", {
    foreground: rgbColor(110, 183, 255)
  });

  drawPanelFrame(frame, 1, 5, 35, 14);
  drawPanelFrame(frame, 40, 5, 35, 14);
  frame.drawText({ x: 3, y: 6 }, "COARSE", {
    foreground: rgbColor(244, 246, 250),
    bold: true
  });
  frame.drawText({ x: 42, y: 6 }, "BRAILLE SURFACE", {
    foreground: rgbColor(244, 246, 250),
    bold: true
  });

  frame.blit(coarse, { x: 2, y: 7 });
  frame.blit(dense, { x: 41, y: 7 });

  return frame;
}

process.stdout.write(renderSurfaceAnsi(buildFrame()));
process.stdout.write("\n");
