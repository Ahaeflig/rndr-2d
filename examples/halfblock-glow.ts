import {
  DenseLightSurface,
  HalfBlockLightSurface,
  Surface,
  createCell,
  renderSurfaceAnsi,
  rgbColor,
  type DenseLightColor
} from "../src/index.js";

const FRAME_WIDTH = 108;
const FRAME_HEIGHT = 30;
const PANEL_WIDTH = 48;
const PANEL_HEIGHT = 24;
const BACKGROUND = { r: 0, g: 0, b: 0 } satisfies DenseLightColor;
const BLUE = { r: 35, g: 92, b: 255 } satisfies DenseLightColor;
const CYAN = { r: 63, g: 225, b: 255 } satisfies DenseLightColor;
const WHITE = { r: 235, g: 252, b: 255 } satisfies DenseLightColor;
const MAGENTA = { r: 197, g: 78, b: 255 } satisfies DenseLightColor;

function createBrailleGlow() {
  const surface = new DenseLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    minEnergy: 0.025,
    dither: true,
    ditherSeed: 37,
    minDotDensity: 0.01,
    maxDotDensity: 0.68,
    ditherScale: 0.56,
    colorScale: 1.32,
    boldEnergy: 0.45
  });
  const center = { x: surface.dotWidth / 2, y: surface.dotHeight / 2 };

  surface.addRing(center, 31, 23, BLUE, 0.18);
  surface.addRing(center, 31, 12, CYAN, 0.48);
  surface.addRing(center, 31, 3.8, WHITE, 0.9);
  surface.addCircle({ x: center.x - 13, y: center.y - 15 }, 4, WHITE, 0.8);
  surface.addCircle({ x: center.x + 18, y: center.y + 13 }, 3, MAGENTA, 0.62);

  return surface;
}

function createHalfBlockGlow() {
  const surface = new HalfBlockLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    minEnergy: 0.015,
    brightnessBase: 0.12,
    brightnessPower: 0.38,
    brightnessScale: 1.06,
    colorScale: 1.26,
    boldEnergy: 0.45
  });
  const center = { x: surface.sampleWidth / 2, y: surface.sampleHeight / 2 };

  surface.addRing(center, 16, 14, BLUE, 0.24);
  surface.addRing(center, 16, 8, CYAN, 0.5);
  surface.addRing(center, 16, 2.4, WHITE, 1);
  surface.addCircle({ x: center.x - 7, y: center.y - 8 }, 2.5, WHITE, 0.75);
  surface.addCircle({ x: center.x + 10, y: center.y + 7 }, 2, MAGENTA, 0.6);

  return surface;
}

function drawBox(surface: Surface, x: number, y: number, width: number, height: number) {
  const style = { foreground: rgbColor(43, 53, 75) };

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

  frame.drawText({ x: 3, y: 1 }, "braille dots: sharper, noisy color", {
    foreground: rgbColor(156, 177, 210)
  });
  frame.drawText({ x: 57, y: 1 }, "half blocks: smoother color glow", {
    foreground: rgbColor(190, 232, 255),
    bold: true
  });

  drawBox(frame, 2, 3, PANEL_WIDTH + 2, PANEL_HEIGHT + 2);
  drawBox(frame, 56, 3, PANEL_WIDTH + 2, PANEL_HEIGHT + 2);
  frame.blit(createBrailleGlow(), { x: 3, y: 4 });
  frame.blit(createHalfBlockGlow(), { x: 57, y: 4 });

  return frame;
}

process.stdout.write(renderSurfaceAnsi(buildFrame()));
process.stdout.write("\n");
