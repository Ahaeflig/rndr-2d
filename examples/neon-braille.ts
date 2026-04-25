import {
  DenseLightSurface,
  Surface,
  createCell,
  renderSurfaceAnsi,
  rgbColor,
  type DenseLightColor,
  type Point
} from "../src/index.js";

type Rgb = DenseLightColor;

const WIDTH = 112;
const HEIGHT = 33;
const BACKGROUND = { r: 0, g: 0, b: 0 } satisfies Rgb;

const GREEN = { r: 118, g: 255, b: 64 } satisfies Rgb;
const GREEN_CORE = { r: 228, g: 255, b: 82 } satisfies Rgb;
const CYAN_EYE = { r: 127, g: 255, b: 235 } satisfies Rgb;
const ORANGE = { r: 255, g: 97, b: 35 } satisfies Rgb;
const AMBER = { r: 255, g: 211, b: 48 } satisfies Rgb;
const ROSE = { r: 255, g: 74, b: 129 } satisfies Rgb;
const BLUE = { r: 72, g: 156, b: 255 } satisfies Rgb;
const VIOLET = { r: 216, g: 112, b: 255 } satisfies Rgb;
const ICE = { r: 190, g: 224, b: 255 } satisfies Rgb;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mix(a: Rgb, b: Rgb, amount: number) {
  const t = clamp01(amount);

  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  } satisfies Rgb;
}

function drawLeafCreature(buffer: DenseLightSurface, origin: Point) {
  const x = origin.x;
  const y = origin.y;

  buffer.addHalo({ x: x + 31, y: y + 34 }, 34, GREEN, 0.5);
  buffer.addHalo({ x: x + 31, y: y + 20 }, 21, GREEN_CORE, 0.3);
  buffer.addHalo({ x: x + 10, y: y + 53 }, 17, GREEN, 0.24);
  buffer.addHalo({ x: x + 56, y: y + 47 }, 16, GREEN, 0.22);

  buffer.addEllipse({ x: x + 31, y: y + 42 }, 14, 20, GREEN, 0.9);
  buffer.addCircle({ x: x + 31, y: y + 22 }, 14, mix(GREEN, GREEN_CORE, 0.35), 1);
  buffer.addPolygon(
    [
      { x: x + 18, y: y + 14 },
      { x: x + 8, y: y + 2 },
      { x: x + 26, y: y + 9 }
    ],
    GREEN_CORE,
    0.82
  );
  buffer.addPolygon(
    [
      { x: x + 42, y: y + 10 },
      { x: x + 56, y: y },
      { x: x + 48, y: y + 18 }
    ],
    GREEN_CORE,
    0.82
  );
  buffer.addPolygon(
    [
      { x: x + 13, y: y + 32 },
      { x: x - 5, y: y + 24 },
      { x: x + 9, y: y + 48 }
    ],
    GREEN,
    0.58
  );
  buffer.addPolygon(
    [
      { x: x + 48, y: y + 31 },
      { x: x + 66, y: y + 22 },
      { x: x + 55, y: y + 50 }
    ],
    GREEN,
    0.58
  );

  buffer.addLine({ x: x + 4, y: y + 58 }, { x: x + 17, y: y + 45 }, GREEN_CORE, 0.55, 1.1);
  buffer.addLine({ x: x + 47, y: y + 52 }, { x: x + 62, y: y + 38 }, GREEN_CORE, 0.45, 1);
  buffer.addLine({ x: x + 23, y: y + 60 }, { x: x + 23, y: y + 73 }, GREEN_CORE, 0.75, 1.2);
  buffer.addLine({ x: x + 39, y: y + 60 }, { x: x + 39, y: y + 73 }, GREEN_CORE, 0.75, 1.2);
  buffer.addCircle({ x: x + 23, y: y + 75 }, 2.2, GREEN_CORE, 0.8);
  buffer.addCircle({ x: x + 39, y: y + 75 }, 2.2, GREEN_CORE, 0.8);
  buffer.addCircle({ x: x + 24, y: y + 25 }, 2.2, CYAN_EYE, 1.35);
  buffer.addCircle({ x: x + 38, y: y + 25 }, 2.2, CYAN_EYE, 1.35);
  buffer.addCircle({ x: x + 31, y: y + 49 }, 2.6, GREEN_CORE, 1.25);
  buffer.addSparkles({ x: x - 14, y: y - 2, width: 92, height: 86 }, GREEN_CORE, 17);
}

function drawFlameFox(buffer: DenseLightSurface, origin: Point) {
  const x = origin.x;
  const y = origin.y;

  buffer.addHalo({ x: x + 30, y: y + 33 }, 32, ORANGE, 0.55);
  buffer.addHalo({ x: x + 61, y: y + 38 }, 29, ROSE, 0.42);
  buffer.addHalo({ x: x + 32, y: y + 22 }, 19, AMBER, 0.32);

  buffer.addEllipse({ x: x + 32, y: y + 45 }, 12, 21, ORANGE, 0.95);
  buffer.addCircle({ x: x + 31, y: y + 23 }, 14, ORANGE, 1.05);
  buffer.addPolygon(
    [
      { x: x + 18, y: y + 13 },
      { x: x + 14, y: y },
      { x: x + 29, y: y + 12 }
    ],
    AMBER,
    1
  );
  buffer.addPolygon(
    [
      { x: x + 40, y: y + 12 },
      { x: x + 51, y: y + 1 },
      { x: x + 45, y: y + 17 }
    ],
    AMBER,
    1
  );
  buffer.addPolygon(
    [
      { x: x + 48, y: y + 37 },
      { x: x + 70, y: y + 17 },
      { x: x + 76, y: y + 44 },
      { x: x + 58, y: y + 63 }
    ],
    ROSE,
    0.72
  );
  buffer.addPolygon(
    [
      { x: x + 53, y: y + 39 },
      { x: x + 69, y: y + 24 },
      { x: x + 70, y: y + 45 },
      { x: x + 58, y: y + 57 }
    ],
    AMBER,
    0.78
  );
  buffer.addCircle({ x: x + 25, y: y + 26 }, 2.4, AMBER, 1.35);
  buffer.addCircle({ x: x + 38, y: y + 25 }, 2.4, AMBER, 1.35);
  buffer.addCircle({ x: x + 28, y: y + 55 }, 3.2, AMBER, 1.2);
  buffer.addLine({ x: x + 24, y: y + 63 }, { x: x + 24, y: y + 77 }, AMBER, 0.9, 1.2);
  buffer.addLine({ x: x + 40, y: y + 63 }, { x: x + 40, y: y + 77 }, AMBER, 0.9, 1.2);
  buffer.addSparkles({ x: x - 8, y: y - 8, width: 98, height: 94 }, AMBER, 43);
}

function drawMoonWyvern(buffer: DenseLightSurface, origin: Point) {
  const x = origin.x;
  const y = origin.y;

  buffer.addHalo({ x: x + 36, y: y + 40 }, 31, BLUE, 0.46);
  buffer.addHalo({ x: x + 48, y: y + 27 }, 35, VIOLET, 0.35);
  buffer.addHalo({ x: x + 72, y: y + 54 }, 26, BLUE, 0.26);

  buffer.addEllipse({ x: x + 38, y: y + 44 }, 18, 18, BLUE, 0.92);
  buffer.addCircle({ x: x + 20, y: y + 34 }, 9, mix(BLUE, ICE, 0.2), 0.9);
  buffer.addPolygon(
    [
      { x: x + 18, y: y + 27 },
      { x: x + 11, y: y + 12 },
      { x: x + 28, y: y + 25 }
    ],
    VIOLET,
    0.78
  );
  buffer.addPolygon(
    [
      { x: x + 45, y: y + 34 },
      { x: x + 66, y: y + 12 },
      { x: x + 70, y: y + 42 }
    ],
    VIOLET,
    0.68
  );
  buffer.addPolygon(
    [
      { x: x + 45, y: y + 48 },
      { x: x + 75, y: y + 44 },
      { x: x + 67, y: y + 64 }
    ],
    VIOLET,
    0.62
  );
  buffer.addLine({ x: x + 52, y: y + 53 }, { x: x + 76, y: y + 67 }, BLUE, 0.78, 1.2);
  buffer.addLine({ x: x + 76, y: y + 67 }, { x: x + 88, y: y + 56 }, ICE, 0.6, 1);
  buffer.addLine({ x: x + 28, y: y + 58 }, { x: x + 25, y: y + 77 }, ICE, 0.84, 1.1);
  buffer.addLine({ x: x + 45, y: y + 59 }, { x: x + 46, y: y + 78 }, ICE, 0.84, 1.1);
  buffer.addCircle({ x: x + 17, y: y + 36 }, 2.2, ICE, 1.3);
  buffer.addCircle({ x: x + 30, y: y + 37 }, 2.2, ICE, 1.3);
  buffer.addCircle({ x: x + 30, y: y + 53 }, 3, ICE, 1.12);
  buffer.addSparkles({ x: x - 6, y: y - 8, width: 108, height: 96 }, ICE, 71);
}

function buildFrame() {
  const buffer = new DenseLightSurface(WIDTH, HEIGHT, {
    background: BACKGROUND,
    activationThreshold: 0.55,
    dither: true,
    minEnergy: 0.06,
    maxDotDensity: 0.62,
    colorScale: 1.28,
    boldEnergy: 0.55
  });

  buffer.addSparkles({ x: 0, y: 0, width: buffer.dotWidth, height: buffer.dotHeight }, BLUE, 5);
  drawLeafCreature(buffer, { x: 12, y: 32 });
  drawFlameFox(buffer, { x: 75, y: 27 });
  drawMoonWyvern(buffer, { x: 145, y: 34 });

  const frame = new Surface(
    WIDTH,
    HEIGHT,
    createCell(" ", {
      background: rgbColor(BACKGROUND.r, BACKGROUND.g, BACKGROUND.b)
    })
  );

  frame.blit(buffer.toBrailleSurface(), { x: 0, y: 0 });

  return frame;
}

process.stdout.write(renderSurfaceAnsi(buildFrame()));
process.stdout.write("\n");
