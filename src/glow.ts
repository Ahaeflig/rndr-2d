import {
  BRAILLE_DOT_COLUMNS,
  BRAILLE_DOT_ROWS,
  BrailleSurface,
  brailleCellSizeFromDotSize
} from "./braille.js";
import { createCell, type Cell } from "./cell.js";
import { rgbColor } from "./color.js";
import { plotLinePoints, pointInPolygon, type Point, type Size } from "./geometry.js";
import type { RasterSource } from "./raster.js";
import { Surface } from "./surface.js";

export interface DenseLightColor {
  r: number;
  g: number;
  b: number;
}

export interface DenseLightSample {
  energy: number;
  color: DenseLightColor;
}

export interface LightColorRampStop {
  energy: number;
  color: DenseLightColor;
}

export type LightColorRamp = readonly LightColorRampStop[];

export type LightDitherMode = "hash" | "bayer4";

export interface DenseLightSurfaceOptions {
  background?: DenseLightColor;
  minEnergy?: number;
  activationThreshold?: number;
  dither?: boolean;
  ditherSeed?: number;
  ditherMode?: LightDitherMode;
  minDotDensity?: number;
  maxDotDensity?: number;
  ditherPower?: number;
  ditherScale?: number;
  brightnessBase?: number;
  brightnessPower?: number;
  brightnessScale?: number;
  colorScale?: number;
  boldEnergy?: number;
  colorRamp?: LightColorRamp;
  backgroundGlow?: boolean;
  backgroundGlowMinEnergy?: number;
  backgroundGlowScale?: number;
  backgroundGlowRamp?: LightColorRamp;
}

export interface HalfBlockLightSurfaceOptions {
  background?: DenseLightColor;
  minEnergy?: number;
  brightnessBase?: number;
  brightnessPower?: number;
  brightnessScale?: number;
  colorScale?: number;
  boldEnergy?: number;
  colorRamp?: LightColorRamp;
  backgroundGlow?: boolean;
  backgroundGlowMinEnergy?: number;
  backgroundGlowScale?: number;
  backgroundGlowRamp?: LightColorRamp;
}

export interface HybridLightSurfaceOptions {
  dense?: DenseLightSurfaceOptions;
  halfBlock?: HalfBlockLightSurfaceOptions;
}

export interface LightPulseOptions {
  frame: number;
  period: number;
  base?: number;
  amplitude?: number;
  phase?: number;
}

interface LightAccumulator {
  energy: number;
  r: number;
  g: number;
  b: number;
}

const DEFAULT_BACKGROUND = { r: 0, g: 0, b: 0 } satisfies DenseLightColor;
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
] as const;

function assertDimension(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

function assertFinite(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number.`);
  }
}

function assertPositive(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number.`);
  }
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeColor(color: DenseLightColor) {
  assertFinite("Light color red", color.r);
  assertFinite("Light color green", color.g);
  assertFinite("Light color blue", color.b);

  return {
    r: clampByte(color.r),
    g: clampByte(color.g),
    b: clampByte(color.b)
  } satisfies DenseLightColor;
}

function mixColor(a: DenseLightColor, b: DenseLightColor, amount: number) {
  const t = clamp01(amount);

  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  } satisfies DenseLightColor;
}

function scaleColor(color: DenseLightColor, amount: number) {
  return {
    r: clampByte(color.r * amount),
    g: clampByte(color.g * amount),
    b: clampByte(color.b * amount)
  } satisfies DenseLightColor;
}

function cloneColor(color: DenseLightColor) {
  return {
    r: color.r,
    g: color.g,
    b: color.b
  } satisfies DenseLightColor;
}

function hashNoise(x: number, y: number, seed: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;

  return n - Math.floor(n);
}

function ditherValue(x: number, y: number, seed: number, mode: LightDitherMode) {
  if (mode === "bayer4") {
    const offset = Math.trunc(seed);
    const row = BAYER4[((y + offset) % 4 + 4) % 4];
    const value = row?.[((x + offset) % 4 + 4) % 4] ?? 0;

    return (value + 0.5) / 16;
  }

  return hashNoise(x, y, seed);
}

function normalizeColorRamp(ramp: LightColorRamp | undefined) {
  if (!ramp) {
    return undefined;
  }

  if (ramp.length === 0) {
    throw new RangeError("Light color ramp must contain at least one stop.");
  }

  const normalized = ramp.map((stop) => {
    assertNonNegative("Light color ramp stop energy", stop.energy);

    return {
      energy: stop.energy,
      color: normalizeColor(stop.color)
    } satisfies LightColorRampStop;
  });

  normalized.sort((a, b) => a.energy - b.energy);

  return normalized;
}

export function sampleLightColorRamp(ramp: LightColorRamp, energy: number) {
  assertFinite("Light color ramp sample energy", energy);

  const stops = normalizeColorRamp(ramp);

  if (!stops) {
    throw new RangeError("Light color ramp must contain at least one stop.");
  }

  if (energy <= stops[0]!.energy) {
    return cloneColor(stops[0]!.color);
  }

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const next = stops[index]!;

    if (energy <= next.energy) {
      const span = next.energy - previous.energy;
      const amount = span <= 0 ? 1 : (energy - previous.energy) / span;

      return scaleColor(mixColor(previous.color, next.color, amount), 1);
    }
  }

  return cloneColor(stops[stops.length - 1]!.color);
}

function averageLightColor(light: LightAccumulator) {
  return {
    r: light.r / light.energy,
    g: light.g / light.energy,
    b: light.b / light.energy
  } satisfies DenseLightColor;
}

function lightColor(light: LightAccumulator, ramp: LightColorRamp | undefined) {
  return ramp ? sampleLightColorRamp(ramp, light.energy) : averageLightColor(light);
}

function renderedLightColor(
  light: LightAccumulator,
  options: {
    background: DenseLightColor;
    brightnessBase: number;
    brightnessPower: number;
    brightnessScale: number;
    colorScale: number;
    colorRamp?: LightColorRamp | undefined;
  }
) {
  const baseColor = lightColor(light, options.colorRamp);
  const brightness = clamp01(
    options.brightnessBase + Math.pow(light.energy, options.brightnessPower) * options.brightnessScale
  );

  return scaleColor(mixColor(options.background, baseColor, brightness), options.colorScale);
}

function accumulateLight(target: LightAccumulator, source: LightAccumulator | undefined) {
  if (!source || source.energy <= 0) {
    return;
  }

  target.energy += source.energy;
  target.r += source.r;
  target.g += source.g;
  target.b += source.b;
}

function emptyLight(): LightAccumulator {
  return {
    energy: 0,
    r: 0,
    g: 0,
    b: 0
  };
}

function normalizeOptions(options: DenseLightSurfaceOptions) {
  const background = normalizeColor(options.background ?? DEFAULT_BACKGROUND);
  const minEnergy = options.minEnergy ?? 0.04;
  const activationThreshold = options.activationThreshold ?? 0.55;
  const minDotDensity = options.minDotDensity ?? 0.015;
  const maxDotDensity = options.maxDotDensity ?? 0.62;
  const ditherPower = options.ditherPower ?? 0.62;
  const ditherScale = options.ditherScale ?? 0.46;
  const brightnessBase = options.brightnessBase ?? 0.44;
  const brightnessPower = options.brightnessPower ?? 0.42;
  const brightnessScale = options.brightnessScale ?? 0.72;
  const colorScale = options.colorScale ?? 1.28;
  const boldEnergy = options.boldEnergy ?? 0.55;
  const ditherSeed = options.ditherSeed ?? 913;
  const backgroundGlowMinEnergy = options.backgroundGlowMinEnergy ?? 0.08;
  const backgroundGlowScale = options.backgroundGlowScale ?? 0.5;
  const colorRamp = normalizeColorRamp(options.colorRamp);
  const backgroundGlowRamp = normalizeColorRamp(options.backgroundGlowRamp);

  assertFinite("Dense light dither seed", ditherSeed);
  assertNonNegative("Dense light minimum energy", minEnergy);
  assertNonNegative("Dense light minimum dot density", minDotDensity);
  assertNonNegative("Dense light maximum dot density", maxDotDensity);
  assertNonNegative("Dense light dither power", ditherPower);
  assertNonNegative("Dense light dither scale", ditherScale);
  assertNonNegative("Dense light brightness base", brightnessBase);
  assertNonNegative("Dense light brightness power", brightnessPower);
  assertNonNegative("Dense light brightness scale", brightnessScale);
  assertNonNegative("Dense light color scale", colorScale);
  assertNonNegative("Dense light bold energy", boldEnergy);
  assertNonNegative("Dense light background glow minimum energy", backgroundGlowMinEnergy);
  assertNonNegative("Dense light background glow scale", backgroundGlowScale);

  if (!Number.isFinite(activationThreshold) || activationThreshold < 0 || activationThreshold > 1) {
    throw new RangeError("Dense light activation threshold must be between 0 and 1.");
  }

  if (minDotDensity > 1 || maxDotDensity > 1) {
    throw new RangeError("Dense light dot densities must be between 0 and 1.");
  }

  if (minDotDensity > maxDotDensity) {
    throw new RangeError("Dense light minimum dot density must not exceed maximum dot density.");
  }

  return {
    background,
    minEnergy,
    activationThreshold,
    dither: options.dither ?? true,
    ditherSeed,
    ditherMode: options.ditherMode ?? "hash",
    minDotDensity,
    maxDotDensity,
    ditherPower,
    ditherScale,
    brightnessBase,
    brightnessPower,
    brightnessScale,
    colorScale,
    boldEnergy,
    colorRamp,
    backgroundGlow: options.backgroundGlow ?? false,
    backgroundGlowMinEnergy,
    backgroundGlowScale,
    backgroundGlowRamp
  };
}

function normalizeHalfBlockOptions(options: HalfBlockLightSurfaceOptions) {
  const background = normalizeColor(options.background ?? DEFAULT_BACKGROUND);
  const minEnergy = options.minEnergy ?? 0.02;
  const brightnessBase = options.brightnessBase ?? 0.18;
  const brightnessPower = options.brightnessPower ?? 0.42;
  const brightnessScale = options.brightnessScale ?? 0.95;
  const colorScale = options.colorScale ?? 1.18;
  const boldEnergy = options.boldEnergy ?? 0.65;
  const backgroundGlowMinEnergy = options.backgroundGlowMinEnergy ?? 0.04;
  const backgroundGlowScale = options.backgroundGlowScale ?? 0.55;
  const colorRamp = normalizeColorRamp(options.colorRamp);
  const backgroundGlowRamp = normalizeColorRamp(options.backgroundGlowRamp);

  assertNonNegative("Half-block light minimum energy", minEnergy);
  assertNonNegative("Half-block light brightness base", brightnessBase);
  assertNonNegative("Half-block light brightness power", brightnessPower);
  assertNonNegative("Half-block light brightness scale", brightnessScale);
  assertNonNegative("Half-block light color scale", colorScale);
  assertNonNegative("Half-block light bold energy", boldEnergy);
  assertNonNegative("Half-block light background glow minimum energy", backgroundGlowMinEnergy);
  assertNonNegative("Half-block light background glow scale", backgroundGlowScale);

  return {
    background,
    minEnergy,
    brightnessBase,
    brightnessPower,
    brightnessScale,
    colorScale,
    boldEnergy,
    colorRamp,
    backgroundGlow: options.backgroundGlow ?? false,
    backgroundGlowMinEnergy,
    backgroundGlowScale,
    backgroundGlowRamp
  };
}

export class DenseLightSurface implements RasterSource {
  readonly width: number;
  readonly height: number;
  readonly dotWidth: number;
  readonly dotHeight: number;
  private readonly options: ReturnType<typeof normalizeOptions>;
  private readonly lights: LightAccumulator[];
  private compiledBraille: BrailleSurface | null = null;
  private compiledSurface: Surface | null = null;

  constructor(width: number, height: number, options: DenseLightSurfaceOptions = {}) {
    assertDimension("Dense light surface width", width);
    assertDimension("Dense light surface height", height);

    this.width = width;
    this.height = height;
    this.dotWidth = width * BRAILLE_DOT_COLUMNS;
    this.dotHeight = height * BRAILLE_DOT_ROWS;
    this.options = normalizeOptions(options);
    this.lights = Array.from({ length: this.dotWidth * this.dotHeight }, () => ({
      energy: 0,
      r: 0,
      g: 0,
      b: 0
    }));
  }

  static fromDotSize(dotWidth: number, dotHeight: number, options: DenseLightSurfaceOptions = {}) {
    const size: Size = brailleCellSizeFromDotSize({ width: dotWidth, height: dotHeight });

    return new DenseLightSurface(size.width, size.height, options);
  }

  private dotIndex(x: number, y: number) {
    return y * this.dotWidth + x;
  }

  private insideDots(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.dotWidth && y < this.dotHeight;
  }

  private invalidate() {
    this.compiledBraille = null;
    this.compiledSurface = null;
  }

  clear() {
    for (const light of this.lights) {
      light.energy = 0;
      light.r = 0;
      light.g = 0;
      light.b = 0;
    }

    this.invalidate();
  }

  lightAt(x: number, y: number): DenseLightSample | null {
    if (!this.insideDots(x, y)) {
      return null;
    }

    const light = this.lights[this.dotIndex(x, y)];

    if (!light || light.energy <= 0) {
      return null;
    }

    return {
      energy: light.energy,
      color: {
        r: light.r / light.energy,
        g: light.g / light.energy,
        b: light.b / light.energy
      }
    };
  }

  addDot(x: number, y: number, color: DenseLightColor, energy = 1) {
    const dotX = Math.round(x);
    const dotY = Math.round(y);

    if (!this.insideDots(dotX, dotY) || energy <= 0) {
      return;
    }

    assertFinite("Light energy", energy);
    const normalizedColor = normalizeColor(color);
    const light = this.lights[this.dotIndex(dotX, dotY)];

    if (!light) {
      return;
    }

    light.energy += energy;
    light.r += normalizedColor.r * energy;
    light.g += normalizedColor.g * energy;
    light.b += normalizedColor.b * energy;
    this.invalidate();
  }

  addCircle(center: Point, radius: number, color: DenseLightColor, energy = 1) {
    assertNonNegative("Dense light circle radius", radius);

    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - center.x;
        const dy = y + 0.5 - center.y;

        if (dx * dx + dy * dy <= radius * radius) {
          this.addDot(x, y, color, energy);
        }
      }
    }
  }

  addEllipse(center: Point, radiusX: number, radiusY: number, color: DenseLightColor, energy = 1) {
    assertPositive("Dense light ellipse radius X", radiusX);
    assertPositive("Dense light ellipse radius Y", radiusY);

    const minX = Math.max(0, Math.floor(center.x - radiusX));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radiusX));
    const minY = Math.max(0, Math.floor(center.y - radiusY));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radiusY));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x + 0.5 - center.x) / radiusX;
        const dy = (y + 0.5 - center.y) / radiusY;

        if (dx * dx + dy * dy <= 1) {
          this.addDot(x, y, color, energy);
        }
      }
    }
  }

  addHalo(center: Point, radius: number, color: DenseLightColor, strength: number, falloff = 2.1) {
    assertPositive("Dense light halo radius", radius);
    assertFinite("Dense light halo strength", strength);
    assertPositive("Dense light halo falloff", falloff);

    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);

        if (distance > radius) {
          continue;
        }

        const t = 1 - distance / radius;
        this.addDot(x, y, color, Math.pow(t, falloff) * strength);
      }
    }
  }

  addRing(center: Point, radius: number, spread: number, color: DenseLightColor, strength = 1, falloff = 2.1) {
    assertNonNegative("Dense light ring radius", radius);
    assertPositive("Dense light ring spread", spread);
    assertFinite("Dense light ring strength", strength);
    assertPositive("Dense light ring falloff", falloff);

    const minX = Math.max(0, Math.floor(center.x - radius - spread));
    const maxX = Math.min(this.dotWidth - 1, Math.ceil(center.x + radius + spread));
    const minY = Math.max(0, Math.floor(center.y - radius - spread));
    const maxY = Math.min(this.dotHeight - 1, Math.ceil(center.y + radius + spread));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.abs(Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y) - radius);

        if (distance <= spread) {
          this.addDot(x, y, color, Math.pow(1 - distance / spread, falloff) * strength);
        }
      }
    }
  }

  addLine(from: Point, to: Point, color: DenseLightColor, energy = 1, radius = 0.8) {
    assertNonNegative("Dense light line radius", radius);

    for (const point of plotLinePoints(from, to)) {
      this.addCircle(point, radius, color, energy);
    }
  }

  addPolygon(points: readonly Point[], color: DenseLightColor, energy = 1) {
    if (points.length < 3) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const startX = Math.max(0, Math.floor(minX));
    const startY = Math.max(0, Math.floor(minY));
    const endX = Math.min(this.dotWidth - 1, Math.ceil(maxX));
    const endY = Math.min(this.dotHeight - 1, Math.ceil(maxY));

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
          this.addDot(x, y, color, energy);
        }
      }
    }
  }

  addSparkles(bounds: { x: number; y: number; width: number; height: number }, color: DenseLightColor, seed: number) {
    const endX = bounds.x + bounds.width;
    const endY = bounds.y + bounds.height;

    for (let y = bounds.y; y < endY; y += 1) {
      for (let x = bounds.x; x < endX; x += 1) {
        const noise = hashNoise(x, y, seed);

        if (noise > 0.994) {
          const energy = 0.42 + hashNoise(y, x, seed + 11) * 0.9;

          this.addDot(x, y, color, energy);

          if (noise > 0.998) {
            this.addDot(x + 1, y, color, energy * 0.55);
            this.addDot(x - 1, y, color, energy * 0.55);
            this.addDot(x, y + 1, color, energy * 0.55);
            this.addDot(x, y - 1, color, energy * 0.55);
          }
        }
      }
    }
  }

  private dotVisible(x: number, y: number, energy: number) {
    if (energy <= this.options.minEnergy) {
      return false;
    }

    if (!this.options.dither) {
      return true;
    }

    const density = Math.min(
      this.options.maxDotDensity,
      this.options.minDotDensity + Math.pow(energy, this.options.ditherPower) * this.options.ditherScale
    );

    return ditherValue(x, y, this.options.ditherSeed, this.options.ditherMode) < density;
  }

  private compileBraille() {
    if (this.compiledBraille) {
      return this.compiledBraille;
    }

    const surface = new BrailleSurface(this.width, this.height, {
      activationThreshold: this.options.activationThreshold
    });

    for (let y = 0; y < this.dotHeight; y += 1) {
      for (let x = 0; x < this.dotWidth; x += 1) {
        const light = this.lights[this.dotIndex(x, y)];

        if (!light || !this.dotVisible(x, y, light.energy)) {
          continue;
        }

        const foreground = renderedLightColor(light, this.options);

        surface.paintDot(x, y, {
          value: 1,
          style: {
            foreground: rgbColor(foreground.r, foreground.g, foreground.b),
            background: rgbColor(
              this.options.background.r,
              this.options.background.g,
              this.options.background.b
            ),
            bold: light.energy > this.options.boldEnergy
          }
        });
      }
    }

    this.compiledBraille = surface;
    return surface;
  }

  private cellLight(cellX: number, cellY: number) {
    const light = emptyLight();

    for (let localY = 0; localY < BRAILLE_DOT_ROWS; localY += 1) {
      for (let localX = 0; localX < BRAILLE_DOT_COLUMNS; localX += 1) {
        accumulateLight(
          light,
          this.lights[this.dotIndex(
            cellX * BRAILLE_DOT_COLUMNS + localX,
            cellY * BRAILLE_DOT_ROWS + localY
          )]
        );
      }
    }

    return light;
  }

  private backgroundGlowColor(light: LightAccumulator) {
    if (!this.options.backgroundGlow || light.energy <= this.options.backgroundGlowMinEnergy) {
      return null;
    }

    return renderedLightColor(light, {
      ...this.options,
      colorRamp: this.options.backgroundGlowRamp ?? this.options.colorRamp,
      colorScale: this.options.colorScale * this.options.backgroundGlowScale
    });
  }

  private compileSurface() {
    if (this.compiledSurface) {
      return this.compiledSurface;
    }

    const surface = this.compileBraille().toSurface();

    if (this.options.backgroundGlow) {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const backgroundGlow = this.backgroundGlowColor(this.cellLight(x, y));

          if (!backgroundGlow) {
            continue;
          }

          const cell = surface.cellAt(x, y);
          const background = rgbColor(backgroundGlow.r, backgroundGlow.g, backgroundGlow.b);

          surface.setCell(
            x,
            y,
            createCell(cell?.glyph ?? " ", {
              ...(cell?.style ?? {}),
              background
            })
          );
        }
      }
    }

    this.compiledSurface = surface;
    return surface;
  }

  toBrailleSurface() {
    return this.compileBraille().clone();
  }

  toSurface() {
    return this.compileSurface().clone();
  }

  cellAt(x: number, y: number) {
    return this.compileSurface().cellAt(x, y);
  }
}

export class HalfBlockLightSurface implements RasterSource {
  readonly width: number;
  readonly height: number;
  readonly sampleWidth: number;
  readonly sampleHeight: number;
  private readonly options: ReturnType<typeof normalizeHalfBlockOptions>;
  private readonly lights: LightAccumulator[];
  private compiled: (Cell | null)[] | null = null;

  constructor(width: number, height: number, options: HalfBlockLightSurfaceOptions = {}) {
    assertDimension("Half-block light surface width", width);
    assertDimension("Half-block light surface height", height);

    this.width = width;
    this.height = height;
    this.sampleWidth = width;
    this.sampleHeight = height * 2;
    this.options = normalizeHalfBlockOptions(options);
    this.lights = Array.from({ length: this.sampleWidth * this.sampleHeight }, () => ({
      energy: 0,
      r: 0,
      g: 0,
      b: 0
    }));
  }

  private sampleIndex(x: number, y: number) {
    return y * this.sampleWidth + x;
  }

  private insideSamples(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.sampleWidth && y < this.sampleHeight;
  }

  private invalidate() {
    this.compiled = null;
  }

  clear() {
    for (const light of this.lights) {
      light.energy = 0;
      light.r = 0;
      light.g = 0;
      light.b = 0;
    }

    this.invalidate();
  }

  lightAt(x: number, y: number): DenseLightSample | null {
    if (!this.insideSamples(x, y)) {
      return null;
    }

    const light = this.lights[this.sampleIndex(x, y)];

    if (!light || light.energy <= 0) {
      return null;
    }

    return {
      energy: light.energy,
      color: {
        r: light.r / light.energy,
        g: light.g / light.energy,
        b: light.b / light.energy
      }
    };
  }

  addSample(x: number, y: number, color: DenseLightColor, energy = 1) {
    const sampleX = Math.round(x);
    const sampleY = Math.round(y);

    if (!this.insideSamples(sampleX, sampleY) || energy <= 0) {
      return;
    }

    assertFinite("Light energy", energy);
    const normalizedColor = normalizeColor(color);
    const light = this.lights[this.sampleIndex(sampleX, sampleY)];

    if (!light) {
      return;
    }

    light.energy += energy;
    light.r += normalizedColor.r * energy;
    light.g += normalizedColor.g * energy;
    light.b += normalizedColor.b * energy;
    this.invalidate();
  }

  addCircle(center: Point, radius: number, color: DenseLightColor, energy = 1) {
    assertNonNegative("Half-block light circle radius", radius);

    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.sampleWidth - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.sampleHeight - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - center.x;
        const dy = y + 0.5 - center.y;

        if (dx * dx + dy * dy <= radius * radius) {
          this.addSample(x, y, color, energy);
        }
      }
    }
  }

  addEllipse(center: Point, radiusX: number, radiusY: number, color: DenseLightColor, energy = 1) {
    assertPositive("Half-block light ellipse radius X", radiusX);
    assertPositive("Half-block light ellipse radius Y", radiusY);

    const minX = Math.max(0, Math.floor(center.x - radiusX));
    const maxX = Math.min(this.sampleWidth - 1, Math.ceil(center.x + radiusX));
    const minY = Math.max(0, Math.floor(center.y - radiusY));
    const maxY = Math.min(this.sampleHeight - 1, Math.ceil(center.y + radiusY));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = (x + 0.5 - center.x) / radiusX;
        const dy = (y + 0.5 - center.y) / radiusY;

        if (dx * dx + dy * dy <= 1) {
          this.addSample(x, y, color, energy);
        }
      }
    }
  }

  addHalo(center: Point, radius: number, color: DenseLightColor, strength: number, falloff = 2) {
    assertPositive("Half-block light halo radius", radius);
    assertFinite("Half-block light halo strength", strength);
    assertPositive("Half-block light halo falloff", falloff);

    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.sampleWidth - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.sampleHeight - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);

        if (distance > radius) {
          continue;
        }

        const t = 1 - distance / radius;

        this.addSample(x, y, color, Math.pow(t, falloff) * strength);
      }
    }
  }

  addRing(center: Point, radius: number, spread: number, color: DenseLightColor, strength = 1, falloff = 2.1) {
    assertNonNegative("Half-block light ring radius", radius);
    assertPositive("Half-block light ring spread", spread);
    assertFinite("Half-block light ring strength", strength);
    assertPositive("Half-block light ring falloff", falloff);

    const minX = Math.max(0, Math.floor(center.x - radius - spread));
    const maxX = Math.min(this.sampleWidth - 1, Math.ceil(center.x + radius + spread));
    const minY = Math.max(0, Math.floor(center.y - radius - spread));
    const maxY = Math.min(this.sampleHeight - 1, Math.ceil(center.y + radius + spread));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.abs(Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y) - radius);

        if (distance <= spread) {
          this.addSample(x, y, color, Math.pow(1 - distance / spread, falloff) * strength);
        }
      }
    }
  }

  addLine(from: Point, to: Point, color: DenseLightColor, energy = 1, radius = 0.8) {
    assertNonNegative("Half-block light line radius", radius);

    for (const point of plotLinePoints(from, to)) {
      this.addCircle(point, radius, color, energy);
    }
  }

  addPolygon(points: readonly Point[], color: DenseLightColor, energy = 1) {
    if (points.length < 3) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const startX = Math.max(0, Math.floor(minX));
    const startY = Math.max(0, Math.floor(minY));
    const endX = Math.min(this.sampleWidth - 1, Math.ceil(maxX));
    const endY = Math.min(this.sampleHeight - 1, Math.ceil(maxY));

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, points)) {
          this.addSample(x, y, color, energy);
        }
      }
    }
  }

  private sampleColor(light: LightAccumulator | undefined) {
    if (!light || light.energy <= this.options.minEnergy) {
      return null;
    }

    return {
      color: renderedLightColor(light, this.options),
      energy: light.energy
    };
  }

  private backgroundGlowColor(light: LightAccumulator | undefined) {
    if (!light || !this.options.backgroundGlow || light.energy <= this.options.backgroundGlowMinEnergy) {
      return null;
    }

    return renderedLightColor(light, {
      ...this.options,
      colorRamp: this.options.backgroundGlowRamp ?? this.options.colorRamp,
      colorScale: this.options.colorScale * this.options.backgroundGlowScale
    });
  }

  private compileCell(x: number, y: number) {
    const upperLight = this.lights[this.sampleIndex(x, y * 2)];
    const lowerLight = this.lights[this.sampleIndex(x, y * 2 + 1)];
    const upper = this.sampleColor(upperLight);
    const lower = this.sampleColor(lowerLight);
    const upperBackgroundGlow = this.backgroundGlowColor(upperLight);
    const lowerBackgroundGlow = this.backgroundGlowColor(lowerLight);
    const background = rgbColor(
      this.options.background.r,
      this.options.background.g,
      this.options.background.b
    );

    if (upper && lower) {
      return createCell("▀", {
        foreground: rgbColor(upper.color.r, upper.color.g, upper.color.b),
        background: rgbColor(lower.color.r, lower.color.g, lower.color.b),
        bold: Math.max(upper.energy, lower.energy) > this.options.boldEnergy
      });
    }

    if (upper) {
      return createCell("▀", {
        foreground: rgbColor(upper.color.r, upper.color.g, upper.color.b),
        background: lowerBackgroundGlow
          ? rgbColor(lowerBackgroundGlow.r, lowerBackgroundGlow.g, lowerBackgroundGlow.b)
          : background,
        bold: upper.energy > this.options.boldEnergy
      });
    }

    if (lower) {
      return createCell("▄", {
        foreground: rgbColor(lower.color.r, lower.color.g, lower.color.b),
        background: upperBackgroundGlow
          ? rgbColor(upperBackgroundGlow.r, upperBackgroundGlow.g, upperBackgroundGlow.b)
          : background,
        bold: lower.energy > this.options.boldEnergy
      });
    }

    if (upperBackgroundGlow || lowerBackgroundGlow) {
      const glow = lowerBackgroundGlow ?? upperBackgroundGlow;

      return createCell(" ", {
        background: rgbColor(glow!.r, glow!.g, glow!.b)
      });
    }

    return null;
  }

  private compile() {
    if (this.compiled) {
      return this.compiled;
    }

    this.compiled = new Array<Cell | null>(this.width * this.height).fill(null);

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.compiled[y * this.width + x] = this.compileCell(x, y);
      }
    }

    return this.compiled;
  }

  cellAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }

    const cell = this.compile()[y * this.width + x];

    return cell ? { glyph: cell.glyph, ...(cell.style ? { style: { ...cell.style } } : {}) } : null;
  }

  toSurface() {
    return Surface.fromRaster(this);
  }
}

export class HybridLightSurface implements RasterSource {
  readonly width: number;
  readonly height: number;
  readonly soft: HalfBlockLightSurface;
  readonly detail: DenseLightSurface;

  constructor(width: number, height: number, options: HybridLightSurfaceOptions = {}) {
    assertDimension("Hybrid light surface width", width);
    assertDimension("Hybrid light surface height", height);

    this.width = width;
    this.height = height;
    this.soft = new HalfBlockLightSurface(width, height, options.halfBlock);
    this.detail = new DenseLightSurface(width, height, options.dense);
  }

  clear() {
    this.soft.clear();
    this.detail.clear();
  }

  cellAt(x: number, y: number) {
    const softCell = this.soft.cellAt(x, y);
    const detailCell = this.detail.cellAt(x, y);

    if (!softCell) {
      return detailCell;
    }

    if (!detailCell) {
      return softCell;
    }

    return createCell(detailCell.glyph, {
      ...(softCell.style ?? {}),
      ...(detailCell.style ?? {}),
      ...(softCell.style?.background ? { background: softCell.style.background } : {})
    });
  }

  toSurface() {
    return Surface.fromRaster(this);
  }
}

export function lightPulse(options: LightPulseOptions) {
  assertPositive("Light pulse period", options.period);

  const base = options.base ?? 1;
  const amplitude = options.amplitude ?? 0.15;
  const phase = options.phase ?? 0;

  assertFinite("Light pulse frame", options.frame);
  assertFinite("Light pulse base", base);
  assertFinite("Light pulse amplitude", amplitude);
  assertFinite("Light pulse phase", phase);

  return base + Math.sin((options.frame / options.period) * Math.PI * 2 + phase) * amplitude;
}

export function lightShimmerSeed(seed: number, frame: number, stride = 101) {
  assertFinite("Light shimmer seed", seed);
  assertFinite("Light shimmer frame", frame);
  assertFinite("Light shimmer stride", stride);

  return seed + frame * stride;
}
