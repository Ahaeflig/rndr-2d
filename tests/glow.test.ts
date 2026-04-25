import { describe, expect, it } from "vitest";

import {
  DenseLightSurface,
  composeScene,
  rgbColor
} from "../src/index.js";

describe("DenseLightSurface", () => {
  it("additively accumulates light and compiles to braille", () => {
    const light = new DenseLightSurface(1, 1, {
      dither: false,
      activationThreshold: 0.2,
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1,
      boldEnergy: 99
    });

    light.addDot(0, 0, { r: 255, g: 0, b: 0 }, 1);
    light.addDot(0, 0, { r: 0, g: 0, b: 255 }, 1);

    expect(light.lightAt(0, 0)).toEqual({
      energy: 2,
      color: { r: 127.5, g: 0, b: 127.5 }
    });
    expect(light.cellAt(0, 0)?.glyph).toBe("⠁");
    expect(light.cellAt(0, 0)?.style?.foreground).toEqual(rgbColor(128, 0, 128));
  });

  it("paints radial falloff for halo effects", () => {
    const light = DenseLightSurface.fromDotSize(9, 9, {
      dither: false
    });

    light.addHalo({ x: 4.5, y: 4.5 }, 4, { r: 128, g: 255, b: 64 }, 1, 1);

    const center = light.lightAt(4, 4);
    const shoulder = light.lightAt(2, 4);

    expect(center?.energy).toBeGreaterThan(0.9);
    expect(shoulder?.energy).toBeGreaterThan(0);
    expect(shoulder?.energy).toBeLessThan(center?.energy ?? 0);
  });

  it("accumulates weak halo light before compile-time dithering", () => {
    const light = DenseLightSurface.fromDotSize(9, 9, {
      dither: false,
      minEnergy: 0
    });

    for (let index = 0; index < 10; index += 1) {
      light.addHalo({ x: 4.5, y: 4.5 }, 4, { r: 255, g: 255, b: 255 }, 0.1, 1);
    }

    expect(light.lightAt(4, 4)?.energy).toBeCloseTo(1);
  });

  it("paints ring falloff around a radius", () => {
    const light = DenseLightSurface.fromDotSize(13, 13, {
      dither: false
    });

    light.addRing({ x: 6.5, y: 6.5 }, 4, 1.5, { r: 64, g: 192, b: 255 }, 1, 1);

    const center = light.lightAt(6, 6);
    const edge = light.lightAt(10, 6);

    expect(center).toBeNull();
    expect(edge?.energy).toBeGreaterThan(0.6);
  });

  it("can dither bright fields instead of producing solid braille blocks", () => {
    const solid = new DenseLightSurface(1, 1, {
      dither: false,
      activationThreshold: 0.2
    });
    const dithered = new DenseLightSurface(1, 1, {
      dither: true,
      activationThreshold: 0.2,
      minEnergy: 0,
      minDotDensity: 0,
      maxDotDensity: 0.5,
      ditherScale: 0.5,
      ditherSeed: 7
    });

    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        solid.addDot(x, y, { r: 255, g: 96, b: 32 }, 1);
        dithered.addDot(x, y, { r: 255, g: 96, b: 32 }, 1);
      }
    }

    expect(solid.cellAt(0, 0)?.glyph).toBe("⣿");
    expect(dithered.cellAt(0, 0)?.glyph).toBeTruthy();
    expect(dithered.cellAt(0, 0)?.glyph).not.toBe("⣿");
  });

  it("composes into scenes as a raster source", () => {
    const light = new DenseLightSurface(2, 1, {
      dither: false,
      activationThreshold: 0.2
    });

    light.addLine({ x: 0, y: 0 }, { x: 3, y: 3 }, { r: 64, g: 192, b: 255 }, 1);

    const frame = composeScene({
      size: { width: 2, height: 1 },
      layers: [
        {
          name: "glow",
          z: 0,
          items: [{ source: light, position: { x: 0, y: 0 } }]
        }
      ]
    });

    expect(frame.toLines()).toEqual(["⠻⣦"]);
  });

  it("rejects invalid glow compiler options", () => {
    expect(() => new DenseLightSurface(1, 1, { activationThreshold: 1.2 })).toThrow(RangeError);
    expect(() => new DenseLightSurface(1, 1, { minDotDensity: 0.8, maxDotDensity: 0.4 })).toThrow(RangeError);
    expect(() => new DenseLightSurface(1, 1, { ditherSeed: Number.NaN })).toThrow(RangeError);
  });
});
