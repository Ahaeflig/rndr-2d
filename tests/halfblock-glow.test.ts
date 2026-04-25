import { describe, expect, it } from "vitest";

import {
  HalfBlockLightSurface,
  composeScene,
  rgbColor
} from "../src/index.js";

describe("HalfBlockLightSurface", () => {
  it("renders two vertical color samples in one terminal cell", () => {
    const light = new HalfBlockLightSurface(1, 1, {
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1,
      boldEnergy: 99
    });

    light.addSample(0, 0, { r: 255, g: 0, b: 0 }, 1);
    light.addSample(0, 1, { r: 0, g: 0, b: 255 }, 1);

    expect(light.cellAt(0, 0)).toEqual({
      glyph: "▀",
      style: {
        foreground: rgbColor(255, 0, 0),
        background: rgbColor(0, 0, 255),
        bold: false
      }
    });
  });

  it("uses lower-half blocks when only the lower sample is lit", () => {
    const light = new HalfBlockLightSurface(1, 1, {
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1,
      boldEnergy: 99
    });

    light.addSample(0, 1, { r: 64, g: 255, b: 128 }, 1);

    expect(light.cellAt(0, 0)?.glyph).toBe("▄");
    expect(light.cellAt(0, 0)?.style?.foreground).toEqual(rgbColor(64, 255, 128));
  });

  it("additively blends colors per half-block sample", () => {
    const light = new HalfBlockLightSurface(1, 1);

    light.addSample(0, 0, { r: 255, g: 0, b: 0 }, 1);
    light.addSample(0, 0, { r: 0, g: 0, b: 255 }, 3);

    expect(light.lightAt(0, 0)).toEqual({
      energy: 4,
      color: { r: 63.75, g: 0, b: 191.25 }
    });
  });

  it("paints ring falloff in half-block sample space", () => {
    const light = new HalfBlockLightSurface(7, 4);

    light.addRing({ x: 3.5, y: 3.5 }, 2, 1, { r: 255, g: 196, b: 64 }, 1, 1);

    expect(light.lightAt(3, 3)).toBeNull();
    expect(light.lightAt(5, 3)?.energy).toBeGreaterThan(0.4);
  });

  it("composes into scenes as a raster source", () => {
    const light = new HalfBlockLightSurface(2, 1, {
      brightnessBase: 1,
      brightnessScale: 0,
      colorScale: 1,
      boldEnergy: 99
    });

    light.addSample(0, 0, { r: 255, g: 255, b: 255 }, 1);
    light.addSample(1, 1, { r: 255, g: 255, b: 255 }, 1);

    const frame = composeScene({
      size: { width: 2, height: 1 },
      layers: [
        {
          name: "half-block glow",
          z: 0,
          items: [{ source: light, position: { x: 0, y: 0 } }]
        }
      ]
    });

    expect(frame.toLines()).toEqual(["▀▄"]);
  });

  it("rejects invalid half-block glow options and paint inputs", () => {
    expect(() => new HalfBlockLightSurface(1, 1, { minEnergy: -1 })).toThrow(RangeError);
    expect(() => new HalfBlockLightSurface(1, 1, { brightnessPower: Number.NaN })).toThrow(RangeError);
    expect(() => new HalfBlockLightSurface(1, 1).addRing({ x: 0, y: 0 }, 1, 0, { r: 255, g: 255, b: 255 })).toThrow(RangeError);
  });
});
