import { describe, expect, it } from "vitest";

import {
  DenseLightSurface,
  HalfBlockLightSurface,
  HybridLightSurface,
  Surface,
  composeScene,
  createCell,
  lightPulse,
  lightShimmerSeed,
  rgbColor,
  sampleLightColorRamp
} from "../src/index.js";

const ramp = [
  { energy: 0, color: { r: 0, g: 32, b: 96 } },
  { energy: 1, color: { r: 0, g: 224, b: 255 } },
  { energy: 2, color: { r: 255, g: 255, b: 255 } }
] as const;

describe("glow rendering techniques", () => {
  it("samples light color ramps by energy", () => {
    expect(sampleLightColorRamp(ramp, 0.5)).toEqual({ r: 0, g: 128, b: 176 });
    expect(sampleLightColorRamp(ramp, 1.5)).toEqual({ r: 128, g: 240, b: 255 });
  });

  it("uses color ramps when compiling dense light", () => {
    const light = new DenseLightSurface(1, 1, {
      dither: false,
      activationThreshold: 0.2,
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1,
      boldEnergy: 99,
      colorRamp: [
        { energy: 0, color: { r: 255, g: 0, b: 0 } },
        { energy: 1, color: { r: 0, g: 0, b: 255 } }
      ]
    });

    light.addDot(0, 0, { r: 255, g: 255, b: 255 }, 0.5);

    expect(light.cellAt(0, 0)?.style?.foreground).toEqual(rgbColor(128, 0, 128));
  });

  it("supports deterministic ordered dithering", () => {
    const createLight = () => {
      const light = new DenseLightSurface(1, 1, {
        dither: true,
        ditherMode: "bayer4",
        ditherSeed: 0,
        activationThreshold: 0.2,
        minEnergy: 0,
        minDotDensity: 0,
        maxDotDensity: 0.5,
        ditherScale: 0.5
      });

      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 2; x += 1) {
          light.addDot(x, y, { r: 255, g: 255, b: 255 }, 1);
        }
      }

      return light;
    };

    const first = createLight().cellAt(0, 0)?.glyph;
    const second = createLight().cellAt(0, 0)?.glyph;

    expect(first).toBe(second);
    expect(first).toBeTruthy();
    expect(first).not.toBe("⣿");
  });

  it("can emit background-only glow cells below foreground activation", () => {
    const light = new DenseLightSurface(1, 1, {
      dither: false,
      minEnergy: 2,
      backgroundGlow: true,
      backgroundGlowMinEnergy: 0.1,
      backgroundGlowScale: 1,
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1
    });

    light.addDot(0, 0, { r: 64, g: 128, b: 255 }, 0.5);

    expect(light.cellAt(0, 0)).toEqual({
      glyph: " ",
      style: {
        background: rgbColor(64, 128, 255)
      }
    });
  });

  it("can emit background glow in half-block cells", () => {
    const light = new HalfBlockLightSurface(1, 1, {
      minEnergy: 2,
      backgroundGlow: true,
      backgroundGlowMinEnergy: 0.1,
      backgroundGlowScale: 1,
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1
    });

    light.addSample(0, 1, { r: 0, g: 96, b: 255 }, 0.5);

    expect(light.cellAt(0, 0)).toEqual({
      glyph: " ",
      style: {
        background: rgbColor(0, 96, 255)
      }
    });
  });

  it("can tint existing glyphs with background-only glow", () => {
    const board = new Surface(1, 1, createCell("A", {
      foreground: rgbColor(255, 255, 255),
      bold: true
    }));
    const glow = new HalfBlockLightSurface(1, 1, {
      minEnergy: 2,
      backgroundGlow: true,
      backgroundGlowMinEnergy: 0.1,
      backgroundGlowScale: 1,
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1
    });

    glow.addSample(0, 1, { r: 0, g: 96, b: 255 }, 0.5);

    const frame = composeScene({
      size: { width: 1, height: 1 },
      layers: [
        {
          name: "board",
          z: 0,
          items: [{ source: board, position: { x: 0, y: 0 } }]
        },
        {
          name: "glow",
          z: 1,
          items: [{ source: glow, position: { x: 0, y: 0 }, blendMode: "background" }]
        }
      ]
    });

    expect(frame.cellAt(0, 0)).toEqual({
      glyph: "A",
      style: {
        foreground: rgbColor(255, 255, 255),
        background: rgbColor(0, 96, 255),
        bold: true
      }
    });
  });

  it("composes half-block softness under dense braille detail", () => {
    const hybrid = new HybridLightSurface(1, 1, {
      halfBlock: {
        brightnessBase: 1,
        brightnessScale: 0,
        colorScale: 1,
        boldEnergy: 99
      },
      dense: {
        dither: false,
        activationThreshold: 0.2,
        brightnessBase: 1,
        brightnessScale: 0,
        colorScale: 1,
        boldEnergy: 99
      }
    });

    hybrid.soft.addSample(0, 0, { r: 16, g: 32, b: 48 }, 1);
    hybrid.soft.addSample(0, 1, { r: 0, g: 0, b: 255 }, 1);
    hybrid.detail.addDot(0, 0, { r: 255, g: 255, b: 255 }, 1);

    expect(hybrid.cellAt(0, 0)).toEqual({
      glyph: "⠁",
      style: {
        foreground: rgbColor(255, 255, 255),
        background: rgbColor(0, 0, 255),
        bold: false
      }
    });
  });

  it("provides deterministic temporal shimmer helpers", () => {
    expect(lightPulse({ frame: 0, period: 4, base: 1, amplitude: 0.5 })).toBeCloseTo(1);
    expect(lightPulse({ frame: 1, period: 4, base: 1, amplitude: 0.5 })).toBeCloseTo(1.5);
    expect(lightShimmerSeed(20, 3, 7)).toBe(41);
  });
});
