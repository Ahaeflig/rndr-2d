import {
  DEFAULT_HEX_LAYOUT,
  HEX_FACINGS,
  Sprite,
  Surface,
  ansiColor,
  composeScene,
  createCell,
  createHexGridSprite,
  hexFacingFromScreenDelta,
  projectHexCenter,
  rgbColor,
  summarizeSurface,
  type AxialCoord,
  type CellStyle,
  type HexFacing,
  type Point,
  type SurfaceDiffStats,
  type SurfaceStats
} from "../src/index.js";

const FRAME_SIZE = { width: 78, height: 24 } as const;
const BOARD_SIZE = { cols: 6, rows: 4 } as const;
const BOARD_ORIGIN = { x: 1, y: 2 } as const;
const HUD_ORIGIN = { x: 46, y: 1 } as const;
const HUD_SIZE = { width: 31, height: 22 } as const;
const PATH_DURATION_MS = 8000;
const BLAST_DURATION_MS = 1600;
const STATUS_COLOR = ansiColor(250);

const STAR_POINTS = [
  { x: 1, y: 1, phase: 0.0 },
  { x: 8, y: 0, phase: 0.3 },
  { x: 14, y: 1, phase: 0.8 },
  { x: 28, y: 0, phase: 0.5 },
  { x: 37, y: 1, phase: 0.1 },
  { x: 43, y: 0, phase: 0.6 },
  { x: 58, y: 1, phase: 0.4 },
  { x: 66, y: 0, phase: 0.7 },
  { x: 74, y: 1, phase: 0.2 },
  { x: 3, y: 21, phase: 0.7 },
  { x: 11, y: 22, phase: 0.1 },
  { x: 24, y: 21, phase: 0.5 },
  { x: 41, y: 22, phase: 0.2 },
  { x: 55, y: 21, phase: 0.9 },
  { x: 71, y: 22, phase: 0.35 }
] as const;

const PLAYER_PATH: readonly AxialCoord[] = [
  { q: 0, r: 1 },
  { q: 1, r: 0 },
  { q: 3, r: 0 },
  { q: 4, r: 1 },
  { q: 4, r: 2 },
  { q: 3, r: 3 },
  { q: 1, r: 3 },
  { q: 0, r: 2 }
];

const ENEMY_PATH: readonly AxialCoord[] = [
  { q: 5, r: 2 },
  { q: 4, r: 1 },
  { q: 3, r: 0 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 1, r: 2 },
  { q: 2, r: 3 },
  { q: 4, r: 3 }
];

const OBJECTIVE_HEX = { q: 2, r: 1 } as const;
const ESCORT_HEX = { q: 3, r: 2 } as const;

function buildShipSet(color: number, cockpitGlyph: string) {
  const style = {
    foreground: ansiColor(color),
    bold: true
  } satisfies CellStyle;
  const body = Sprite.fromText({
    lines: [" /-\\ ", `| ${cockpitGlyph} |`, " \\_/ "],
    transparentGlyphs: [],
    style
  });

  return Object.fromEntries(
    HEX_FACINGS.map((facing) => {
      const surface = new Surface(9, 5);
      surface.blit(body, { x: 2, y: 1 });

      switch (facing) {
        case "n":
          surface.drawText({ x: 4, y: 0 }, "^", style);
          break;
        case "ne":
          surface.drawText({ x: 6, y: 0 }, "/", style);
          surface.drawText({ x: 8, y: 1 }, ">", style);
          break;
        case "se":
          surface.drawText({ x: 8, y: 3 }, ">", style);
          surface.drawText({ x: 6, y: 4 }, "\\", style);
          break;
        case "s":
          surface.drawText({ x: 4, y: 4 }, "v", style);
          break;
        case "sw":
          surface.drawText({ x: 0, y: 3 }, "<", style);
          surface.drawText({ x: 2, y: 4 }, "/", style);
          break;
        case "nw":
          surface.drawText({ x: 2, y: 0 }, "\\", style);
          surface.drawText({ x: 0, y: 1 }, "<", style);
          break;
        default:
          break;
      }

      return [facing, Sprite.fromRaster(surface)];
    })
  ) as Record<HexFacing, Sprite>;
}

const PLAYER_SHIPS = buildShipSet(214, "O");
const ENEMY_SHIPS = buildShipSet(81, "X");

const BOARD_SPRITE = createHexGridSprite({
  board: BOARD_SIZE,
  fill: ({ q, r }) => {
    const value = (q * 2 + r) % 3;
    return value === 0 ? "." : value === 1 ? ":" : ";";
  },
  style: ({ q, r }) => ({
    foreground: ansiColor((q + r) % 2 === 0 ? 244 : 240)
  })
});

const PULSE_SPRITES = [
  Sprite.fromText({
    lines: [" * ", "***", " * "],
    transparentGlyphs: [" "],
    style: {
      foreground: ansiColor(226),
      bold: true
    }
  }),
  Sprite.fromText({
    lines: [" .*. ", "*   *", " .*. "],
    transparentGlyphs: [" "],
    style: {
      foreground: ansiColor(220),
      bold: true
    }
  }),
  Sprite.fromText({
    lines: ["*   *", "  *  ", "*   *"],
    transparentGlyphs: [" "],
    style: {
      foreground: ansiColor(196),
      bold: true
    }
  })
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function easeInOutSine(t: number) {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

function boardPoint(coord: AxialCoord) {
  const projected = projectHexCenter(DEFAULT_HEX_LAYOUT, coord);
  return {
    x: BOARD_ORIGIN.x + projected.x,
    y: BOARD_ORIGIN.y + projected.y
  };
}

function spriteTopLeft(center: Point, sprite: Sprite) {
  return {
    x: Math.round(center.x - Math.floor(sprite.width / 2)),
    y: Math.round(center.y - Math.floor(sprite.height / 2))
  };
}

function samplePath(path: readonly AxialCoord[], elapsedMs: number, phaseMs = 0) {
  const cycle = ((elapsedMs + phaseMs) % PATH_DURATION_MS + PATH_DURATION_MS) % PATH_DURATION_MS;
  const scaled = (cycle / PATH_DURATION_MS) * path.length;
  const index = Math.floor(scaled) % path.length;
  const nextIndex = (index + 1) % path.length;
  const localT = easeInOutSine(scaled - Math.floor(scaled));
  const start = boardPoint(path[index] ?? path[0]!);
  const end = boardPoint(path[nextIndex] ?? path[0]!);
  const center = {
    x: lerp(start.x, end.x, localT),
    y: lerp(start.y, end.y, localT)
  };

  return {
    center,
    facing: hexFacingFromScreenDelta({
      dx: end.x - start.x,
      dy: end.y - start.y,
      layout: DEFAULT_HEX_LAYOUT,
      fallback: "ne"
    }),
    segmentIndex: index
  };
}

function makePanel(title: string, accent: number) {
  const surface = new Surface(HUD_SIZE.width, HUD_SIZE.height);
  const border = ansiColor(accent);
  const dim = ansiColor(243);

  surface.drawText({ x: 0, y: 0 }, "+-----------------------------+", {
    foreground: border,
    bold: true
  });

  for (let y = 1; y < HUD_SIZE.height - 1; y += 1) {
    surface.drawText({ x: 0, y }, "|", { foreground: dim });
    surface.drawText({ x: HUD_SIZE.width - 1, y }, "|", { foreground: dim });
  }

  surface.drawText({ x: 0, y: HUD_SIZE.height - 1 }, "+-----------------------------+", {
    foreground: border,
    bold: true
  });
  surface.drawText({ x: 2, y: 1 }, title, {
    foreground: ansiColor(255),
    bold: true
  });

  return surface;
}

function drawMetric(surface: Surface, y: number, label: string, value: string, color = STATUS_COLOR) {
  surface.drawText({ x: 2, y }, `${label.padEnd(10, " ")} ${value}`, {
    foreground: color
  });
}

function drawCenteredText(surface: Surface, point: Point, text: string, style?: CellStyle) {
  surface.drawText(
    {
      x: point.x - Math.floor(text.length / 2),
      y: point.y
    },
    text,
    style
  );
}

function drawBoardLabels(surface: Surface) {
  drawCenteredText(surface, boardPoint({ q: 1, r: 1 }), "A1", {
    foreground: ansiColor(15),
    bold: true
  });
  drawCenteredText(surface, boardPoint({ q: 2, r: 1 }), "CORE", {
    foreground: ansiColor(226),
    bold: true
  });
  drawCenteredText(surface, boardPoint({ q: 3, r: 2 }), "B2", {
    foreground: ansiColor(81),
    bold: true
  });
}

function createStarfield(elapsedMs: number) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);

  for (const star of STAR_POINTS) {
    const pulse = Math.sin(elapsedMs / 420 + star.phase * Math.PI * 2);
    const glyph = pulse > 0.72 ? "*" : pulse > 0.15 ? "." : "·";
    const color = pulse > 0.72 ? ansiColor(255) : pulse > 0.15 ? ansiColor(250) : ansiColor(238);
    surface.setCell(star.x, star.y, createCell(glyph, { foreground: color }));
  }

  return surface;
}

function createAttackTrail(elapsedMs: number, from: Point, to: Point) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const phase = (elapsedMs % BLAST_DURATION_MS) / BLAST_DURATION_MS;
  const active = phase < 0.72;

  if (!active) {
    return surface;
  }

  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const dx = (to.x - from.x) / Math.max(1, steps);
  const dy = (to.y - from.y) / Math.max(1, steps);

  for (let step = 0; step <= steps; step += 2) {
    const x = Math.round(from.x + dx * step);
    const y = Math.round(from.y + dy * step);
    surface.setCell(x, y, createCell(".", { foreground: ansiColor(242) }));
  }

  const projectilePoint = {
    x: Math.round(lerp(from.x, to.x, clamp(phase / 0.72, 0, 1))),
    y: Math.round(lerp(from.y, to.y, clamp(phase / 0.72, 0, 1)))
  };

  surface.setCell(projectilePoint.x, projectilePoint.y, createCell("*", {
    foreground: ansiColor(226),
    bold: true
  }));

  return surface;
}

function createPulseLayer(elapsedMs: number, target: Point) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const index = Math.floor((elapsedMs % 900) / 300) % PULSE_SPRITES.length;
  const sprite = PULSE_SPRITES[index] ?? PULSE_SPRITES[0];
  const position = spriteTopLeft(target, sprite);
  surface.blit(sprite, position);
  return surface;
}

function drawRotationGallery(surface: Surface) {
  const groups = [
    {
      labelRow: 9,
      items: [
        { facing: "n" as const, label: "N", x: 2, y: 10 },
        { facing: "ne" as const, label: "NE", x: 11, y: 10 },
        { facing: "se" as const, label: "SE", x: 20, y: 10 }
      ]
    },
    {
      labelRow: 15,
      items: [
        { facing: "s" as const, label: "S", x: 2, y: 16 },
        { facing: "sw" as const, label: "SW", x: 11, y: 16 },
        { facing: "nw" as const, label: "NW", x: 20, y: 16 }
      ]
    }
  ] as const;

  for (const group of groups) {
    for (const item of group.items) {
      const sprite = PLAYER_SHIPS[item.facing] ?? PLAYER_SHIPS.n;
      surface.drawText({ x: item.x + 3, y: group.labelRow }, item.label, {
        foreground: ansiColor(245),
        bold: true
      });

      surface.blit(sprite, { x: item.x, y: item.y });
    }
  }
}

function createHud(input: {
  elapsedMs: number;
  frameNumber: number;
  fps: number;
  previousStats: SurfaceStats | null;
  previousDiff: SurfaceDiffStats | null;
}) {
  const surface = makePanel("LIVE RENDERER", 226);
  const seconds = (input.elapsedMs / 1000).toFixed(1);
  const lastDiff = input.previousDiff;
  const lastStats = input.previousStats;

  drawMetric(surface, 3, "time", `${seconds}s`);
  drawMetric(surface, 4, "frame", String(input.frameNumber));
  drawMetric(surface, 5, "fps", String(input.fps));
  drawMetric(surface, 6, "diff cells", String(lastDiff?.changedCellCount ?? 0));
  drawMetric(surface, 7, "diff runs", String(lastDiff?.changedRunCount ?? 0));
  drawMetric(surface, 8, "visible", String(lastStats?.nonBlankGlyphCellCount ?? 0));

  drawRotationGallery(surface);

  return surface;
}

export interface LiveDemoFrameInput {
  elapsedMs: number;
  frameNumber: number;
  fps: number;
  previousStats: SurfaceStats | null;
  previousDiff: SurfaceDiffStats | null;
}

export function buildLiveDemoFrame(input: LiveDemoFrameInput) {
  const player = samplePath(PLAYER_PATH, input.elapsedMs, 0);
  const enemy = samplePath(ENEMY_PATH, input.elapsedMs, PATH_DURATION_MS / 2);
  const objective = boardPoint(OBJECTIVE_HEX);
  const escort = boardPoint(ESCORT_HEX);
  const playerSprite = PLAYER_SHIPS[player.facing] ?? PLAYER_SHIPS.n;
  const enemySprite = ENEMY_SHIPS[enemy.facing] ?? ENEMY_SHIPS.n;

  const labels = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  drawBoardLabels(labels);
  drawCenteredText(labels, objective, "!", {
    foreground: ansiColor(196),
    bold: true
  });
  drawCenteredText(labels, escort, "+", {
    foreground: ansiColor(81),
    bold: true
  });

  const frame = composeScene({
    size: FRAME_SIZE,
    background: createCell(" ", {
      background: rgbColor(10, 10, 16)
    }),
    layers: [
      {
        name: "stars",
        z: 0,
        items: [{ source: createStarfield(input.elapsedMs), position: { x: 0, y: 0 } }]
      },
      {
        name: "board",
        z: 1,
        items: [{ source: BOARD_SPRITE, position: BOARD_ORIGIN }]
      },
      {
        name: "labels",
        z: 2,
        items: [{ source: labels, position: { x: 0, y: 0 } }]
      },
      {
        name: "pulse",
        z: 3,
        items: [
          { source: createPulseLayer(input.elapsedMs, objective), position: { x: 0, y: 0 } },
          { source: createPulseLayer(input.elapsedMs + 350, escort), position: { x: 0, y: 0 } }
        ]
      },
      {
        name: "trail",
        z: 4,
        items: [{ source: createAttackTrail(input.elapsedMs, player.center, enemy.center), position: { x: 0, y: 0 } }]
      },
      {
        name: "units",
        z: 5,
        items: [
          {
            source: playerSprite,
            position: spriteTopLeft(player.center, playerSprite)
          },
          {
            source: enemySprite,
            position: spriteTopLeft(enemy.center, enemySprite)
          }
        ]
      },
      {
        name: "hud",
        z: 6,
        items: [
          {
            source: createHud({
              elapsedMs: input.elapsedMs,
              frameNumber: input.frameNumber,
              fps: input.fps,
              previousStats: input.previousStats,
              previousDiff: input.previousDiff
            }),
            position: HUD_ORIGIN
          }
        ]
      }
    ]
  });

  const stats = summarizeSurface(frame);
  const statusColor = input.previousDiff && input.previousDiff.changedCellCount > 70 ? ansiColor(196) : ansiColor(118);
  frame.drawText({ x: 2, y: 0 }, "rndr-2d live demo", {
    foreground: ansiColor(255),
    bold: true
  });
  frame.drawText({ x: 22, y: 0 }, `moving layers ${stats.nonBlankGlyphCellCount} glyphs`, {
    foreground: STATUS_COLOR
  });
  frame.drawText({ x: 2, y: FRAME_SIZE.height - 1 }, "board + pulse + trail + units + hud", {
    foreground: ansiColor(244)
  });
  frame.drawText({ x: 38, y: FRAME_SIZE.height - 1 }, "diff renderer active", {
    foreground: statusColor,
    bold: true
  });

  return frame;
}
