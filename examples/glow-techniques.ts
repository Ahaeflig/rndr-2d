import {
  DenseLightSurface,
  HalfBlockLightSurface,
  HybridLightSurface,
  Surface,
  createCell,
  lightPulse,
  lightShimmerSeed,
  renderSurfaceAnsi,
  rgbColor,
  type DenseLightColor,
  type LightColorRamp
} from "../src/index.js";

const BACKGROUND = { r: 0, g: 0, b: 0 } satisfies DenseLightColor;
const BLUE = { r: 24, g: 74, b: 255 } satisfies DenseLightColor;
const CYAN = { r: 52, g: 220, b: 255 } satisfies DenseLightColor;
const WHITE = { r: 242, g: 252, b: 255 } satisfies DenseLightColor;
const MAGENTA = { r: 220, g: 82, b: 255 } satisfies DenseLightColor;
const RAMP = [
  { energy: 0, color: { r: 4, g: 20, b: 78 } },
  { energy: 0.7, color: BLUE },
  { energy: 1.3, color: CYAN },
  { energy: 2.1, color: WHITE }
] satisfies LightColorRamp;

const PANEL_WIDTH = 30;
const PANEL_HEIGHT = 12;
const FRAME_WIDTH = 100;
const FRAME_HEIGHT = 31;

function drawBox(surface: Surface, x: number, y: number, width: number, height: number) {
  const style = { foreground: rgbColor(42, 52, 74) };

  surface.drawText({ x, y }, `+${"-".repeat(width - 2)}+`, style);

  for (let row = 1; row < height - 1; row += 1) {
    surface.drawText({ x, y: y + row }, "|", style);
    surface.drawText({ x: x + width - 1, y: y + row }, "|", style);
  }

  surface.drawText({ x, y: y + height - 1 }, `+${"-".repeat(width - 2)}+`, style);
}

function createRampAndOrderedDither() {
  const glow = new DenseLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    colorRamp: RAMP,
    ditherMode: "bayer4",
    ditherSeed: 1,
    minEnergy: 0.015,
    minDotDensity: 0.02,
    maxDotDensity: 0.7,
    colorScale: 1.2,
    boldEnergy: 0.55
  });
  const center = { x: glow.dotWidth / 2, y: glow.dotHeight / 2 };

  glow.addRing(center, 14, 14, CYAN, 0.34);
  glow.addRing(center, 14, 6, WHITE, 0.92);
  glow.addCircle({ x: center.x - 7, y: center.y - 7 }, 3, WHITE, 0.85);

  return glow;
}

function createBackgroundGlow() {
  const glow = new HalfBlockLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    colorRamp: RAMP,
    backgroundGlow: true,
    backgroundGlowMinEnergy: 0.025,
    backgroundGlowScale: 1,
    minEnergy: 0.38,
    brightnessBase: 0.12,
    brightnessScale: 0.98,
    colorScale: 1.16
  });
  const center = { x: glow.sampleWidth / 2, y: glow.sampleHeight / 2 };

  glow.addHalo(center, 21, BLUE, 0.34, 1.5);
  glow.addRing(center, 9, 8, CYAN, 0.42);
  glow.addRing(center, 9, 2.3, WHITE, 1);

  return glow;
}

function createHybridGlow() {
  const glow = new HybridLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    halfBlock: {
      background: BACKGROUND,
      colorRamp: RAMP,
      backgroundGlow: true,
      backgroundGlowMinEnergy: 0.02,
      minEnergy: 0.03,
      colorScale: 1.12
    },
    dense: {
      background: BACKGROUND,
      colorRamp: RAMP,
      ditherMode: "bayer4",
      ditherSeed: 3,
      minEnergy: 0.06,
      minDotDensity: 0,
      maxDotDensity: 0.58,
      colorScale: 1.25
    }
  });
  const softCenter = { x: glow.soft.sampleWidth / 2, y: glow.soft.sampleHeight / 2 };
  const detailCenter = { x: glow.detail.dotWidth / 2, y: glow.detail.dotHeight / 2 };

  glow.soft.addHalo(softCenter, 22, BLUE, 0.34, 1.7);
  glow.soft.addRing(softCenter, 10, 8, CYAN, 0.5);
  glow.detail.addRing(detailCenter, 20, 4, WHITE, 0.9);
  glow.detail.addCircle({ x: detailCenter.x + 9, y: detailCenter.y - 8 }, 2.8, MAGENTA, 0.72);

  return glow;
}

function createTemporalFrame(frame: number) {
  const pulse = lightPulse({ frame, period: 6, base: 0.86, amplitude: 0.32 });
  const glow = new DenseLightSurface(PANEL_WIDTH, PANEL_HEIGHT, {
    background: BACKGROUND,
    colorRamp: RAMP,
    ditherMode: "bayer4",
    ditherSeed: lightShimmerSeed(9, frame, 1),
    minEnergy: 0.02,
    minDotDensity: 0.01,
    maxDotDensity: 0.68,
    colorScale: 1.22
  });
  const center = { x: glow.dotWidth / 2, y: glow.dotHeight / 2 };

  glow.addHalo(center, 20, BLUE, 0.25 * pulse, 1.7);
  glow.addRing(center, 13, 8, CYAN, 0.48 * pulse);
  glow.addRing(center, 13, 3.5, WHITE, 0.88 * pulse);

  return glow;
}

function buildFrame() {
  const frame = new Surface(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    createCell(" ", { background: rgbColor(BACKGROUND.r, BACKGROUND.g, BACKGROUND.b) })
  );
  const panels = [
    { title: "ramp + ordered dither", source: createRampAndOrderedDither(), x: 2, y: 3 },
    { title: "background glow", source: createBackgroundGlow(), x: 35, y: 3 },
    { title: "hybrid compositor", source: createHybridGlow(), x: 68, y: 3 },
    { title: "temporal frame 0", source: createTemporalFrame(0), x: 2, y: 18 },
    { title: "temporal frame 1", source: createTemporalFrame(1), x: 35, y: 18 },
    { title: "temporal frame 2", source: createTemporalFrame(2), x: 68, y: 18 }
  ] as const;

  frame.drawText({ x: 2, y: 1 }, "glow technique proofs", {
    foreground: rgbColor(228, 238, 255),
    bold: true
  });

  for (const panel of panels) {
    frame.drawText({ x: panel.x, y: panel.y - 1 }, panel.title, {
      foreground: rgbColor(144, 170, 210)
    });
    drawBox(frame, panel.x - 1, panel.y, PANEL_WIDTH + 2, PANEL_HEIGHT + 2);
    frame.blit(panel.source, { x: panel.x, y: panel.y + 1 });
  }

  return frame;
}

process.stdout.write(renderSurfaceAnsi(buildFrame()));
process.stdout.write("\n");
