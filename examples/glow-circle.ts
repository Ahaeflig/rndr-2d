import {
  BrailleSurface,
  DenseLightSurface,
  Surface,
  createCell,
  renderSurfaceAnsi,
  rgbColor
} from "../src/index.js";

const FRAME_WIDTH = 104;
const FRAME_HEIGHT = 31;
const PANEL_WIDTH = 46;
const PANEL_HEIGHT = 25;
const BACKGROUND = { r: 0, g: 0, b: 0 };
const CYAN = { r: 68, g: 221, b: 255 };
const BLUE = { r: 38, g: 102, b: 255 };
const WHITE_HOT = { r: 232, g: 252, b: 255 };
const MINT = { r: 96, g: 255, b: 201 };

function createPlainCircle() {
  const surface = new BrailleSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    activationThreshold: 0.2
  });
  const center = {
    x: surface.dotWidth / 2,
    y: surface.dotHeight / 2
  };

  surface.fillCircle(center, 34, {
    value: 1,
    style: {
      foreground: rgbColor(CYAN.r, CYAN.g, CYAN.b),
      background: rgbColor(BACKGROUND.r, BACKGROUND.g, BACKGROUND.b),
      bold: true
    }
  });

  return surface;
}

function createGlowCircle() {
  const surface = new DenseLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    minEnergy: 0.025,
    dither: true,
    ditherSeed: 29,
    minDotDensity: 0.01,
    maxDotDensity: 0.72,
    ditherPower: 0.55,
    ditherScale: 0.58,
    brightnessBase: 0.28,
    brightnessPower: 0.35,
    brightnessScale: 0.9,
    colorScale: 1.35,
    boldEnergy: 0.45
  });
  const center = {
    x: surface.dotWidth / 2,
    y: surface.dotHeight / 2
  };

  surface.addRing(center, 34, 25, BLUE, 0.2, 2.2);
  surface.addRing(center, 34, 14, CYAN, 0.52, 2.2);
  surface.addRing(center, 34, 4.2, WHITE_HOT, 0.92, 2.2);
  surface.addRing(center, 23, 8, MINT, 0.22, 2.2);
  surface.addCircle({ x: center.x - 16, y: center.y - 19 }, 3.5, WHITE_HOT, 0.9);
  surface.addCircle({ x: center.x + 22, y: center.y + 15 }, 2.8, MINT, 0.68);

  return surface;
}

function drawBox(surface: Surface, x: number, y: number, width: number, height: number) {
  const style = { foreground: rgbColor(42, 54, 82) };

  surface.drawText({ x, y }, `+${"-".repeat(width - 2)}+`, style);

  for (let row = 1; row < height - 1; row += 1) {
    surface.drawText({ x, y: y + row }, "|", style);
    surface.drawText({ x: x + width - 1, y: y + row }, "|", style);
  }

  surface.drawText({ x, y: y + height - 1 }, `+${"-".repeat(width - 2)}+`, style);
}

function buildFrame() {
  const frame = new Surface(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    createCell(" ", {
      background: rgbColor(BACKGROUND.r, BACKGROUND.g, BACKGROUND.b)
    })
  );

  frame.drawText({ x: 3, y: 1 }, "plain braille fill", {
    foreground: rgbColor(116, 135, 170)
  });
  frame.drawText({ x: 55, y: 1 }, "dense light ring + dithered glow", {
    foreground: rgbColor(179, 225, 255),
    bold: true
  });

  drawBox(frame, 2, 3, PANEL_WIDTH + 2, PANEL_HEIGHT + 2);
  drawBox(frame, 54, 3, PANEL_WIDTH + 2, PANEL_HEIGHT + 2);
  frame.blit(createPlainCircle(), { x: 3, y: 4 });
  frame.blit(createGlowCircle(), { x: 55, y: 4 });

  return frame;
}

process.stdout.write(renderSurfaceAnsi(buildFrame()));
process.stdout.write("\n");
