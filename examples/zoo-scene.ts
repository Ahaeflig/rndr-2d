import {
  DEFAULT_HEX_LAYOUT,
  DenseLightSurface,
  HalfBlockLightSurface,
  HybridLightSurface,
  Sprite,
  Surface,
  ansiColor,
  composeScene,
  createCell,
  createHexGridSprite,
  drawTextBlockInRows,
  hexFacingFromScreenDelta,
  hexBoardSize,
  projectHexCenter,
  projectHexContentBox,
  projectHexContentRows,
  rgbColor,
  scaleHexLayout,
  summarizeSurface,
  lightPulse,
  lightShimmerSeed,
  type AxialCoord,
  type CellStyle,
  type DenseLightColor,
  type HexFacing,
  type HexBoardSize,
  type HexLayout,
  type LightColorRamp,
  type Point,
  type Rect,
  type SurfaceDiffStats,
  type SurfaceStats
} from "../src/index.js";
import { DEMO_HEX_FACING_LABELS, buildDemoHexShipSet } from "./demo-hex-ships.js";

export type ZooPage = "play" | "hex" | "style" | "glow";

export interface ZooState {
  page: ZooPage;
  selector: AxialCoord;
  playerCoord: AxialCoord;
  playerFacing: HexFacing;
  autoplay: boolean;
  showStars: boolean;
  showPulse: boolean;
  showTrail: boolean;
  showContentBoxes: boolean;
  showHelp: boolean;
  showDebug: boolean;
  scaleIndex: 0 | 1 | 2;
  paletteIndex: 0 | 1 | 2;
}

export interface ZooFrameInput {
  state: ZooState;
  elapsedMs: number;
  frameNumber: number;
  fps: number;
  previousStats: SurfaceStats | null;
  previousDiff: SurfaceDiffStats | null;
}

const FRAME_SIZE = { width: 80, height: 24 } as const;
const HUD_RECT = { x: 51, y: 1, width: 28, height: 22 } as const;
const PLAY_BOARD_ORIGIN = { x: 1, y: 4 } as const;
const PLAY_BOARD_SIZE = { cols: 5, rows: 3 } as const;
const PATH_DURATION_MS = 7000;
const TRAIL_DURATION_MS = 1600;
const GLOW_PANEL_SIZE = { width: 14, height: 8 } as const;
const GLOW_RAMP = [
  { energy: 0, color: { r: 3, g: 18, b: 72 } },
  { energy: 0.7, color: { r: 35, g: 92, b: 255 } },
  { energy: 1.3, color: { r: 58, g: 224, b: 255 } },
  { energy: 2.1, color: { r: 242, g: 252, b: 255 } }
] satisfies LightColorRamp;
const GLOW_BLUE = { r: 35, g: 92, b: 255 } satisfies DenseLightColor;
const GLOW_CYAN = { r: 58, g: 224, b: 255 } satisfies DenseLightColor;
const GLOW_WHITE = { r: 242, g: 252, b: 255 } satisfies DenseLightColor;
const GLOW_MAGENTA = { r: 220, g: 82, b: 255 } satisfies DenseLightColor;

const STAR_POINTS = [
  { x: 1, y: 1, phase: 0.0 },
  { x: 7, y: 0, phase: 0.6 },
  { x: 14, y: 1, phase: 0.2 },
  { x: 24, y: 0, phase: 0.8 },
  { x: 36, y: 1, phase: 0.4 },
  { x: 48, y: 0, phase: 0.9 },
  { x: 61, y: 1, phase: 0.3 },
  { x: 72, y: 0, phase: 0.7 },
  { x: 4, y: 21, phase: 0.5 },
  { x: 16, y: 22, phase: 0.1 },
  { x: 28, y: 21, phase: 0.75 },
  { x: 43, y: 22, phase: 0.2 },
  { x: 60, y: 21, phase: 0.45 },
  { x: 74, y: 22, phase: 0.65 }
] as const;

const PLAYER_PATH: readonly AxialCoord[] = [
  { q: 0, r: 1 },
  { q: 1, r: 0 },
  { q: 3, r: 0 },
  { q: 4, r: 1 },
  { q: 3, r: 2 },
  { q: 1, r: 2 }
];

const ENEMY_PATH: readonly AxialCoord[] = [
  { q: 4, r: 1 },
  { q: 3, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: 2 },
  { q: 3, r: 2 }
];

const PLAY_OBJECTIVE = { q: 2, r: 1 } as const;

const PALETTES = [
  {
    name: "ember",
    background: rgbColor(10, 10, 16),
    boardPrimary: 244,
    boardSecondary: 240,
    fillGlyphs: [".", ":", ";"] as const,
    player: 214,
    enemy: 81,
    accent: 226
  },
  {
    name: "toxic",
    background: rgbColor(8, 14, 10),
    boardPrimary: 120,
    boardSecondary: 84,
    fillGlyphs: ["~", ".", ":"] as const,
    player: 154,
    enemy: 196,
    accent: 190
  },
  {
    name: "glacier",
    background: rgbColor(8, 12, 20),
    boardPrimary: 117,
    boardSecondary: 75,
    fillGlyphs: [".", "=", ":"] as const,
    player: 123,
    enemy: 205,
    accent: 51
  }
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

function drawTextCentered(surface: Surface, point: Point, text: string, style?: CellStyle) {
  surface.drawText(
    {
      x: point.x - Math.floor(text.length / 2),
      y: point.y
    },
    text,
    style
  );
}

function drawRect(surface: Surface, rect: Rect, style?: CellStyle) {
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  for (let x = rect.x; x < rect.x + rect.width; x += 1) {
    surface.setCell(x, rect.y, createCell(x === rect.x || x === rect.x + rect.width - 1 ? "+" : "-", style));
    surface.setCell(
      x,
      rect.y + rect.height - 1,
      createCell(x === rect.x || x === rect.x + rect.width - 1 ? "+" : "-", style)
    );
  }

  for (let y = rect.y + 1; y < rect.y + rect.height - 1; y += 1) {
    surface.setCell(rect.x, y, createCell("|", style));
    surface.setCell(rect.x + rect.width - 1, y, createCell("|", style));
  }
}

function drawRowSpanMarkers(surface: Surface, rows: readonly Rect[], style?: CellStyle) {
  for (const row of rows) {
    if (row.width <= 0 || row.height <= 0) {
      continue;
    }

    surface.setCell(row.x - 1, row.y, createCell("[", style));
    surface.setCell(row.x + row.width, row.y, createCell("]", style));
  }
}

function twinkleSurface(elapsedMs: number) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);

  for (const star of STAR_POINTS) {
    const pulse = Math.sin(elapsedMs / 380 + star.phase * Math.PI * 2);
    const glyph = pulse > 0.7 ? "*" : pulse > 0.2 ? "." : "·";
    const color = pulse > 0.7 ? ansiColor(255) : pulse > 0.2 ? ansiColor(250) : ansiColor(238);
    surface.setCell(star.x, star.y, createCell(glyph, { foreground: color }));
  }

  return surface;
}

function fillGlyphForCoord(paletteIndex: number, coord: AxialCoord) {
  const palette = PALETTES[paletteIndex] ?? PALETTES[0];
  const value = (coord.q * 2 + coord.r) % palette.fillGlyphs.length;
  return palette.fillGlyphs[value] ?? palette.fillGlyphs[0];
}

function boardStyleForCoord(paletteIndex: number, coord: AxialCoord) {
  const palette = PALETTES[paletteIndex] ?? PALETTES[0];

  return {
    foreground: ansiColor((coord.q + coord.r) % 2 === 0 ? palette.boardPrimary : palette.boardSecondary)
  };
}

function boardPoint(layout: HexLayout, origin: Point, coord: AxialCoord) {
  const projected = projectHexCenter(layout, coord);
  return {
    x: origin.x + projected.x,
    y: origin.y + projected.y
  };
}

function translatedHexContentRows(layout: HexLayout, origin: Point, coord: AxialCoord) {
  return projectHexContentRows(layout, coord).map((row) => ({
    x: origin.x + row.x,
    y: origin.y + row.y,
    width: row.width,
    height: row.height
  }));
}

function rowsBounds(rows: readonly Rect[]): Rect {
  const minX = Math.min(...rows.map((row) => row.x));
  const minY = Math.min(...rows.map((row) => row.y));
  const maxX = Math.max(...rows.map((row) => row.x + row.width));
  const maxY = Math.max(...rows.map((row) => row.y + row.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function spriteTopLeft(center: Point, sprite: Sprite) {
  return {
    x: Math.round(center.x - Math.floor(sprite.width / 2)),
    y: Math.round(center.y - Math.floor(sprite.height / 2))
  };
}

function samplePath(layout: HexLayout, origin: Point, path: readonly AxialCoord[], elapsedMs: number, phaseMs = 0) {
  const cycle = ((elapsedMs + phaseMs) % PATH_DURATION_MS + PATH_DURATION_MS) % PATH_DURATION_MS;
  const scaled = (cycle / PATH_DURATION_MS) * path.length;
  const index = Math.floor(scaled) % path.length;
  const nextIndex = (index + 1) % path.length;
  const localT = easeInOutSine(scaled - Math.floor(scaled));
  const start = boardPoint(layout, origin, path[index] ?? path[0]!);
  const end = boardPoint(layout, origin, path[nextIndex] ?? path[0]!);

  return {
    center: {
      x: lerp(start.x, end.x, localT),
      y: lerp(start.y, end.y, localT)
    },
    facing: hexFacingFromScreenDelta({
      layout,
      dx: end.x - start.x,
      dy: end.y - start.y,
      fallback: "n"
    })
  };
}

function getScaleValue(scaleIndex: number) {
  return [1, 2, 3][scaleIndex] ?? 1;
}

export function getPageBoardForState(state: ZooState): HexBoardSize {
  if (state.page === "play") {
    return PLAY_BOARD_SIZE;
  }

  if (state.page === "hex") {
    const scale = getScaleValue(state.scaleIndex);

    if (scale === 1) {
      return { cols: 5, rows: 3 };
    }

    if (scale === 2) {
      return { cols: 3, rows: 2 };
    }

    return { cols: 2, rows: 1 };
  }

  if (state.page === "style") {
    return { cols: 4, rows: 2 };
  }

  return { cols: 1, rows: 1 };
}

export function clampSelectorToPage(state: ZooState, coord: AxialCoord): AxialCoord {
  const board = getPageBoardForState(state);

  return {
    q: clamp(coord.q, 0, board.cols - 1),
    r: clamp(coord.r, 0, board.rows - 1)
  };
}

function makePanel(title: string) {
  const surface = new Surface(HUD_RECT.width, HUD_RECT.height);
  const border = ansiColor(245);
  surface.drawText({ x: 0, y: 0 }, "+--------------------------+", {
    foreground: border,
    bold: true
  });

  for (let y = 1; y < HUD_RECT.height - 1; y += 1) {
    surface.drawText({ x: 0, y }, "|", { foreground: border });
    surface.drawText({ x: HUD_RECT.width - 1, y }, "|", { foreground: border });
  }

  surface.drawText({ x: 0, y: HUD_RECT.height - 1 }, "+--------------------------+", {
    foreground: border,
    bold: true
  });
  surface.drawText({ x: 2, y: 1 }, title, {
    foreground: ansiColor(255),
    bold: true
  });

  return surface;
}

function hudLine(surface: Surface, y: number, label: string, value: string, color = ansiColor(250)) {
  surface.drawText({ x: 2, y }, `${label.padEnd(9, " ")} ${value}`, {
    foreground: color
  });
}

function createSelectorOverlay(layout: HexLayout, origin: Point, coord: AxialCoord) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const center = boardPoint(layout, origin, coord);
  surface.drawText({ x: center.x - 2, y: center.y }, "[", {
    foreground: ansiColor(226),
    bold: true
  });
  surface.drawText({ x: center.x + 2, y: center.y }, "]", {
    foreground: ansiColor(226),
    bold: true
  });
  return surface;
}

function createHexSelectorOverlay(layout: HexLayout, origin: Point, coord: AxialCoord) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const box = rowsBounds(translatedHexContentRows(layout, origin, coord));
  const markerStyle = {
    foreground: ansiColor(226),
    bold: true
  };
  const midX = box.x + Math.floor((box.width - 1) / 2);
  const midY = box.y + Math.floor((box.height - 1) / 2);

  surface.drawText({ x: box.x - 2, y: midY }, ">>", markerStyle);
  surface.drawText({ x: box.x + box.width, y: midY }, "<<", markerStyle);
  surface.drawText({ x: midX, y: box.y - 1 }, "v", markerStyle);
  surface.drawText({ x: midX, y: box.y + box.height }, "^", markerStyle);

  return surface;
}

function createTrailSurface(elapsedMs: number, from: Point, to: Point) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const phase = (elapsedMs % TRAIL_DURATION_MS) / TRAIL_DURATION_MS;

  if (phase > 0.75) {
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
    x: Math.round(lerp(from.x, to.x, clamp(phase / 0.75, 0, 1))),
    y: Math.round(lerp(from.y, to.y, clamp(phase / 0.75, 0, 1)))
  };
  surface.setCell(projectilePoint.x, projectilePoint.y, createCell("*", {
    foreground: ansiColor(226),
    bold: true
  }));

  return surface;
}

function createPulseSurface(target: Point, paletteIndex: number, elapsedMs: number) {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const phase = Math.floor((elapsedMs % 900) / 300);
  const palette = PALETTES[paletteIndex] ?? PALETTES[0];
  const color = phase === 0 ? ansiColor(palette.accent) : phase === 1 ? ansiColor(220) : ansiColor(196);
  const sprites = [
    Sprite.fromText({
      lines: [" * ", "***", " * "],
      transparentGlyphs: [" "],
      style: { foreground: color, bold: true }
    }),
    Sprite.fromText({
      lines: [" .*. ", "*   *", " .*. "],
      transparentGlyphs: [" "],
      style: { foreground: color, bold: true }
    }),
    Sprite.fromText({
      lines: ["*   *", "  *  ", "*   *"],
      transparentGlyphs: [" "],
      style: { foreground: color, bold: true }
    })
  ] as const;
  const sprite = sprites[phase] ?? sprites[0];
  surface.blit(sprite, spriteTopLeft(target, sprite));
  return surface;
}

function createPlayPage(input: ZooFrameInput) {
  const palette = PALETTES[input.state.paletteIndex] ?? PALETTES[0];
  const layout = DEFAULT_HEX_LAYOUT;
  const playerShips = buildDemoHexShipSet(palette.player, "O");
  const enemyShips = buildDemoHexShipSet(palette.enemy, "X");
  const board = createHexGridSprite({
    board: PLAY_BOARD_SIZE,
    layout,
    fill: (coord) => fillGlyphForCoord(input.state.paletteIndex, coord),
    style: (coord) => boardStyleForCoord(input.state.paletteIndex, coord)
  });

  const player = input.state.autoplay
    ? samplePath(layout, PLAY_BOARD_ORIGIN, PLAYER_PATH, input.elapsedMs, 0)
    : {
        center: boardPoint(layout, PLAY_BOARD_ORIGIN, input.state.playerCoord),
        facing: input.state.playerFacing
      };
  const enemy = input.state.autoplay
    ? samplePath(layout, PLAY_BOARD_ORIGIN, ENEMY_PATH, input.elapsedMs, PATH_DURATION_MS / 2)
    : {
        center: boardPoint(layout, PLAY_BOARD_ORIGIN, { q: 4, r: 1 }),
        facing: "sw" as const
      };
  const playerSprite = playerShips[player.facing] ?? playerShips.n;
  const enemySprite = enemyShips[enemy.facing] ?? enemyShips.sw;
  const objective = boardPoint(layout, PLAY_BOARD_ORIGIN, PLAY_OBJECTIVE);
  const labels = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);

  drawTextCentered(labels, boardPoint(layout, PLAY_BOARD_ORIGIN, { q: 1, r: 1 }), "A1", {
    foreground: ansiColor(15),
    bold: true
  });
  drawTextCentered(labels, objective, "CORE", {
    foreground: ansiColor(palette.accent),
    bold: true
  });

  const hud = makePanel("FEATURE ZOO");
  hudLine(hud, 3, "page", "1 play");
  hudLine(hud, 4, "palette", palette.name);
  hudLine(hud, 5, "mode", input.state.autoplay ? "autoplay" : "manual");
  hudLine(hud, 6, "selector", `${input.state.selector.q},${input.state.selector.r}`);
  hudLine(hud, 7, "facing", DEMO_HEX_FACING_LABELS[input.state.playerFacing] ?? "?");
  hudLine(hud, 8, "pulse", input.state.showPulse ? "on" : "off");
  hudLine(hud, 9, "trail", input.state.showTrail ? "on" : "off");
  hudLine(hud, 10, "stars", input.state.showStars ? "on" : "off");
  hud.drawText({ x: 2, y: 13 }, "Enter move ship", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 14 }, "Q/E rotate 6-way", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 15 }, "Space autoplay", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 17 }, "1 play 2 hex 3 style 4 glow", {
    foreground: ansiColor(250)
  });
  hud.drawText({ x: 2, y: 18 }, "Arrows/HJKL move", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 19 }, "P/T/S toggles", { foreground: ansiColor(250) });

  const frame = composeScene({
    size: FRAME_SIZE,
    background: createCell(" ", {
      background: palette.background
    }),
    layers: [
      ...(input.state.showStars
        ? [{ name: "stars", z: 0, items: [{ source: twinkleSurface(input.elapsedMs), position: { x: 0, y: 0 } }] }]
        : []),
      {
        name: "board",
        z: 1,
        items: [{ source: board, position: PLAY_BOARD_ORIGIN }]
      },
      {
        name: "labels",
        z: 2,
        items: [{ source: labels, position: { x: 0, y: 0 } }]
      },
      ...(input.state.showPulse
        ? [
            {
              name: "pulse",
              z: 3,
              items: [{ source: createPulseSurface(objective, input.state.paletteIndex, input.elapsedMs), position: { x: 0, y: 0 } }]
            }
          ]
        : []),
      ...(input.state.showTrail
        ? [
            {
              name: "trail",
              z: 4,
              items: [{ source: createTrailSurface(input.elapsedMs, player.center, enemy.center), position: { x: 0, y: 0 } }]
            }
          ]
        : []),
      {
        name: "selector",
        z: 5,
        items: [{ source: createSelectorOverlay(layout, PLAY_BOARD_ORIGIN, input.state.selector), position: { x: 0, y: 0 } }]
      },
      {
        name: "units",
        z: 6,
        items: [
          { source: playerSprite, position: spriteTopLeft(player.center, playerSprite) },
          { source: enemySprite, position: spriteTopLeft(enemy.center, enemySprite) }
        ]
      },
      {
        name: "hud",
        z: 7,
        items: [{ source: hud, position: { x: HUD_RECT.x, y: HUD_RECT.y } }]
      }
    ]
  });

  return frame;
}

function createHexPage(input: ZooFrameInput) {
  const palette = PALETTES[input.state.paletteIndex] ?? PALETTES[0];
  const scale = getScaleValue(input.state.scaleIndex);
  const layout = scaleHexLayout(DEFAULT_HEX_LAYOUT, scale);
  const board = getPageBoardForState({ ...input.state, page: "hex" });
  const boardPixels = hexBoardSize(board, layout);
  const origin = {
    x: Math.max(1, Math.floor((HUD_RECT.x - boardPixels.width) / 2)),
    y: Math.max(2, Math.floor((FRAME_SIZE.height - boardPixels.height) / 2))
  };
  const boardSprite = createHexGridSprite({
    board,
    layout,
    fill: (coord) => fillGlyphForCoord(input.state.paletteIndex, coord),
    style: (coord) => boardStyleForCoord(input.state.paletteIndex, coord)
  });
  const content = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);

  for (let q = 0; q < board.cols; q += 1) {
    for (let r = 0; r < board.rows; r += 1) {
      const coord = { q, r };
      const translatedRows = translatedHexContentRows(layout, origin, coord);
      const lines =
        scale === 1
          ? [`cell ${q},${r}`, "hp 12", "en 7"]
          : scale === 2
            ? ["sector q" + q, "row " + r + " flux", "hp 12 en 7", "ridge clear"]
            : [
                `alpha node q${q} r${r}`,
                "terrain ridge west",
                "shield 12  flux 07",
                "threat medium-low",
                "status ready dock",
                "vector hold stable",
                "cargo window open"
              ];

      drawTextBlockInRows(content, {
        rows: translatedRows,
        lines,
        style: {
          foreground: ansiColor(scale === 3 ? 255 : 250),
          bold: scale === 3
        },
        fill: createCell(" ", {
          background: palette.background
        })
      });

      if (input.state.showContentBoxes) {
        drawRowSpanMarkers(content, translatedRows, {
          foreground:
            coord.q === input.state.selector.q && coord.r === input.state.selector.r
              ? ansiColor(196)
              : ansiColor(243),
          bold: coord.q === input.state.selector.q && coord.r === input.state.selector.r
        });
      }
    }
  }

  const hud = makePanel("HEX LAB");
  hudLine(hud, 3, "scale", `${scale}x`);
  hudLine(hud, 4, "board", `${board.cols}x${board.rows}`);
  hudLine(hud, 5, "col step", String(layout.colStep));
  hudLine(hud, 6, "row step", String(layout.rowStep));
  hudLine(hud, 7, "row skew", String(layout.rowSkew));
  const contentBox = projectHexContentBox(layout, { q: 0, r: 0 });
  const usableRows = projectHexContentRows(layout, { q: 0, r: 0 });
  const usableMaxWidth = Math.max(...usableRows.map((row) => row.width));
  hudLine(hud, 8, "box", `${contentBox.width}x${contentBox.height}`);
  hudLine(hud, 9, "usable", `${usableMaxWidth}x${usableRows.length}`);
  hudLine(hud, 10, "selector", `${input.state.selector.q},${input.state.selector.r}`);
  hud.drawText({ x: 2, y: 12 }, "[ / ] scale hexes", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 13 }, "B usable spans", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 14 }, "Arrows change cell", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 16 }, "This page proves the", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 17 }, "layout is parametric.", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 18 }, "Scale 3 gives larger", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 19 }, "multi-line cell text.", { foreground: ansiColor(250) });

  const frame = composeScene({
    size: FRAME_SIZE,
    background: createCell(" ", {
      background: palette.background
    }),
    layers: [
      ...(input.state.showStars
        ? [{ name: "stars", z: 0, items: [{ source: twinkleSurface(input.elapsedMs), position: { x: 0, y: 0 } }] }]
        : []),
      {
        name: "board",
        z: 1,
        items: [{ source: boardSprite, position: origin }]
      },
      {
        name: "content",
        z: 2,
        items: [{ source: content, position: { x: 0, y: 0 } }]
      },
      {
        name: "selector",
        z: 3,
        items: [{ source: createHexSelectorOverlay(layout, origin, input.state.selector), position: { x: 0, y: 0 } }]
      },
      {
        name: "hud",
        z: 4,
        items: [{ source: hud, position: { x: HUD_RECT.x, y: HUD_RECT.y } }]
      }
    ]
  });

  return frame;
}

function swatch(surface: Surface, x: number, y: number, colorCode: number, label: string) {
  surface.drawText({ x, y }, "    ", {
    background: ansiColor(colorCode)
  });
  surface.drawText({ x: x + 5, y }, label, {
    foreground: ansiColor(colorCode),
    bold: true
  });
}

function createStylePage(input: ZooFrameInput) {
  const palette = PALETTES[input.state.paletteIndex] ?? PALETTES[0];
  const background = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);

  for (let y = 2; y < FRAME_SIZE.height - 2; y += 1) {
    for (let x = 1; x < 47; x += 1) {
      const even = (x + y) % 2 === 0;
      background.setCell(x, y, createCell(even ? "." : ":", {
        foreground: ansiColor(even ? 240 : 237)
      }));
    }
  }

  const paletteSets = [
    [196, 202, 208, 214, 220, 226],
    [27, 33, 39, 45, 51, 87],
    [46, 82, 118, 154, 190, 226]
  ] as const;
  const swatches = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  swatches.drawText({ x: 2, y: 3 }, "Color Swatches", {
    foreground: ansiColor(255),
    bold: true
  });

  const paletteRow = paletteSets[input.state.paletteIndex] ?? paletteSets[0];

  for (let index = 0; index < paletteRow.length; index += 1) {
    swatch(swatches, 2, 5 + index, paletteRow[index] ?? 15, String(paletteRow[index] ?? 15));
  }

  swatches.drawText({ x: 24, y: 5 }, "bold text", {
    foreground: ansiColor(255),
    bold: true
  });
  swatches.drawText({ x: 24, y: 7 }, "dim text", {
    foreground: ansiColor(250),
    dim: true
  });
  swatches.drawText({ x: 24, y: 9 }, "underline text", {
    foreground: ansiColor(81),
    underline: true
  });
  swatches.drawText({ x: 24, y: 11 }, "inverse text", {
    foreground: ansiColor(16),
    background: ansiColor(190),
    inverse: true
  });

  const facingShips = buildDemoHexShipSet(palette.player, "O");
  const gallery = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  gallery.drawText({ x: 2, y: 13 }, "6-way Hex Facing: N  NE  SE / S  SW  NW", {
    foreground: ansiColor(255),
    bold: true
  });
  const facingGrid: readonly [HexFacing, Point][] = [
    ["n", { x: 2, y: 14 }],
    ["ne", { x: 16, y: 14 }],
    ["se", { x: 30, y: 14 }],
    ["s", { x: 2, y: 19 }],
    ["sw", { x: 16, y: 19 }],
    ["nw", { x: 30, y: 19 }]
  ];

  for (const [facing, position] of facingGrid) {
    gallery.fillRect(
      {
        x: position.x,
        y: position.y,
        width: 9,
        height: 5
      },
      createCell(" ", {
        background: palette.background
      })
    );
    gallery.blit(facingShips[facing], position);
  }

  const hud = makePanel("STYLE LAB");
  hudLine(hud, 3, "palette", palette.name);
  hudLine(hud, 4, "styles", "fg/bg/bold");
  hudLine(hud, 5, "facing", "hex 6-way");
  hudLine(hud, 6, "diff", input.previousDiff ? `${input.previousDiff.changedCellCount} cells` : "n/a");
  hud.drawText({ x: 2, y: 10 }, "C cycles palettes", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 12 }, "This page is a quick", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 13 }, "visual check for cell", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 14 }, "styles and hex facing.", { foreground: ansiColor(250) });

  return composeScene({
    size: FRAME_SIZE,
    background: createCell(" ", {
      background: palette.background
    }),
    layers: [
      ...(input.state.showStars
        ? [{ name: "stars", z: 0, items: [{ source: twinkleSurface(input.elapsedMs), position: { x: 0, y: 0 } }] }]
        : []),
      {
        name: "checker",
        z: 1,
        items: [{ source: background, position: { x: 0, y: 0 } }]
      },
      {
        name: "swatches",
        z: 2,
        items: [{ source: swatches, position: { x: 0, y: 0 } }]
      },
      {
        name: "gallery",
        z: 3,
        items: [{ source: gallery, position: { x: 0, y: 0 } }]
      },
      {
        name: "hud",
        z: 4,
        items: [{ source: hud, position: { x: HUD_RECT.x, y: HUD_RECT.y } }]
      }
    ]
  });
}

function makeGlowDensePanel(input: ZooFrameInput) {
  const pulse = input.state.showPulse
    ? lightPulse({ frame: input.frameNumber, period: 36, base: 0.88, amplitude: 0.28 })
    : 1;
  const surface = new DenseLightSurface(GLOW_PANEL_SIZE.width, GLOW_PANEL_SIZE.height, {
    colorRamp: GLOW_RAMP,
    background: { r: 0, g: 0, b: 0 },
    ditherMode: "bayer4",
    ditherSeed: lightShimmerSeed(3, input.state.showTrail ? input.frameNumber : 0, 1),
    minEnergy: 0.02,
    minDotDensity: 0.01,
    maxDotDensity: 0.68,
    colorScale: 1.2,
    backgroundGlow: true,
    backgroundGlowMinEnergy: 0.1,
    backgroundGlowScale: 0.46
  });
  const center = {
    x: surface.dotWidth / 2,
    y: surface.dotHeight / 2
  };

  surface.addRing(center, 10, 7, GLOW_BLUE, 0.3 * pulse);
  surface.addRing(center, 10, 3, GLOW_CYAN, 0.72 * pulse);
  surface.addCircle({ x: center.x - 5, y: center.y - 5 }, 2.2, GLOW_WHITE, 0.75 * pulse);

  return surface;
}

function makeGlowHalfBlockPanel(input: ZooFrameInput) {
  const pulse = input.state.showPulse
    ? lightPulse({ frame: input.frameNumber, period: 42, base: 0.9, amplitude: 0.24, phase: 0.8 })
    : 1;
  const surface = new HalfBlockLightSurface(GLOW_PANEL_SIZE.width, GLOW_PANEL_SIZE.height, {
    colorRamp: GLOW_RAMP,
    background: { r: 0, g: 0, b: 0 },
    minEnergy: 0.42,
    backgroundGlow: true,
    backgroundGlowMinEnergy: 0.02,
    backgroundGlowScale: 1,
    colorScale: 1.08
  });
  const center = {
    x: surface.sampleWidth / 2,
    y: surface.sampleHeight / 2
  };

  surface.addHalo(center, 12, GLOW_BLUE, 0.34 * pulse, 1.5);
  surface.addRing(center, 6, 4, GLOW_CYAN, 0.64 * pulse);
  surface.addRing(center, 6, 1.5, GLOW_WHITE, 0.95 * pulse);

  return surface;
}

function makeGlowHybridPanel(input: ZooFrameInput) {
  const pulse = input.state.showPulse
    ? lightPulse({ frame: input.frameNumber, period: 48, base: 0.9, amplitude: 0.3, phase: 1.3 })
    : 1;
  const surface = new HybridLightSurface(GLOW_PANEL_SIZE.width, GLOW_PANEL_SIZE.height, {
    halfBlock: {
      colorRamp: GLOW_RAMP,
      background: { r: 0, g: 0, b: 0 },
      backgroundGlow: true,
      backgroundGlowMinEnergy: 0.02,
      minEnergy: 0.03,
      colorScale: 1.05
    },
    dense: {
      colorRamp: GLOW_RAMP,
      background: { r: 0, g: 0, b: 0 },
      ditherMode: "bayer4",
      ditherSeed: lightShimmerSeed(11, input.state.showTrail ? input.frameNumber : 0, 1),
      minEnergy: 0.06,
      minDotDensity: 0,
      maxDotDensity: 0.58,
      colorScale: 1.2
    }
  });
  const softCenter = {
    x: surface.soft.sampleWidth / 2,
    y: surface.soft.sampleHeight / 2
  };
  const detailCenter = {
    x: surface.detail.dotWidth / 2,
    y: surface.detail.dotHeight / 2
  };

  surface.soft.addHalo(softCenter, 12, GLOW_BLUE, 0.36 * pulse, 1.5);
  surface.soft.addRing(softCenter, 6, 4, GLOW_CYAN, 0.52 * pulse);
  surface.detail.addRing(detailCenter, 11, 2.2, GLOW_WHITE, 0.88 * pulse);
  surface.detail.addCircle({ x: detailCenter.x + 5, y: detailCenter.y - 3 }, 1.6, GLOW_MAGENTA, 0.74 * pulse);

  return surface;
}

function drawGlowPanelLabels(surface: Surface) {
  surface.drawText({ x: 2, y: 3 }, "Dense braille", {
    foreground: ansiColor(250),
    bold: true
  });
  surface.drawText({ x: 19, y: 3 }, "Background glow", {
    foreground: ansiColor(250),
    bold: true
  });
  surface.drawText({ x: 36, y: 3 }, "Hybrid", {
    foreground: ansiColor(250),
    bold: true
  });
}

function createGlowPage(input: ZooFrameInput) {
  const frameBase = new Surface(FRAME_SIZE.width, FRAME_SIZE.height, createCell(" ", {
    background: rgbColor(0, 0, 0)
  }));
  drawGlowPanelLabels(frameBase);
  drawRect(frameBase, { x: 1, y: 4, width: 16, height: 10 }, { foreground: ansiColor(238) });
  drawRect(frameBase, { x: 18, y: 4, width: 16, height: 10 }, { foreground: ansiColor(238) });
  drawRect(frameBase, { x: 35, y: 4, width: 16, height: 10 }, { foreground: ansiColor(238) });
  frameBase.blit(makeGlowDensePanel(input), { x: 2, y: 5 });
  frameBase.blit(makeGlowHalfBlockPanel(input), { x: 19, y: 5 });
  frameBase.blit(makeGlowHybridPanel(input), { x: 36, y: 5 });

  frameBase.drawText({ x: 2, y: 15 }, "Palette ramps map energy to hand-tuned color.", {
    foreground: ansiColor(250)
  });
  frameBase.drawText({ x: 2, y: 16 }, "Background glow carries low-energy light without glyph noise.", {
    foreground: ansiColor(250)
  });
  frameBase.drawText({ x: 2, y: 17 }, "Hybrid glow keeps a soft base under crisp braille highlights.", {
    foreground: ansiColor(250)
  });

  const hud = makePanel("GLOW LAB");
  hudLine(hud, 3, "page", "4 glow");
  hudLine(hud, 4, "pulse", input.state.showPulse ? "animated" : "steady");
  hudLine(hud, 5, "dither", input.state.showTrail ? "shimmer" : "fixed");
  hudLine(hud, 6, "stars", input.state.showStars ? "on" : "off");
  hudLine(hud, 7, "palette", "energy ramp");
  hud.drawText({ x: 2, y: 10 }, "P toggles pulse", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 11 }, "T toggles shimmer", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 12 }, "S toggles stars", { foreground: ansiColor(244) });
  hud.drawText({ x: 2, y: 14 }, "This page proves glow", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 15 }, "as composable raster", { foreground: ansiColor(250) });
  hud.drawText({ x: 2, y: 16 }, "sources in the engine.", { foreground: ansiColor(250) });

  return composeScene({
    size: FRAME_SIZE,
    background: createCell(" ", {
      background: rgbColor(0, 0, 0)
    }),
    layers: [
      ...(input.state.showStars
        ? [{ name: "stars", z: 0, items: [{ source: twinkleSurface(input.elapsedMs), position: { x: 0, y: 0 } }] }]
        : []),
      {
        name: "glow",
        z: 1,
        items: [{ source: frameBase, position: { x: 0, y: 0 } }]
      },
      {
        name: "hud",
        z: 2,
        items: [{ source: hud, position: { x: HUD_RECT.x, y: HUD_RECT.y } }]
      }
    ]
  });
}

function createHelpOverlay() {
  const surface = new Surface(FRAME_SIZE.width, FRAME_SIZE.height);
  const panel = new Surface(48, 17);
  drawRect(panel, { x: 0, y: 0, width: 48, height: 17 }, {
    foreground: ansiColor(226)
  });
  panel.drawText({ x: 2, y: 1 }, "Feature Zoo Controls", {
    foreground: ansiColor(255),
    bold: true
  });
  const lines = [
    "1/2/3 or Tab: switch page",
    "Arrows or HJKL: move selector",
    "Enter: move ship to selector on play page",
    "Q/E: rotate ship through 6 facings",
    "Space: toggle autoplay",
    "P/T/S: pulse, trail, stars",
    "[ and ]: change hex scale in hex lab",
    "B: toggle usable hex row spans",
    "C: cycle palette",
    "4: glow lab",
    "D: toggle debug footer",
    "R: reset state",
    "Esc or Ctrl-C: exit",
    "?: close help"
  ];

  for (let index = 0; index < lines.length; index += 1) {
    panel.drawText({ x: 2, y: 3 + index }, lines[index] ?? "", {
      foreground: ansiColor(250)
    });
  }

  surface.blit(panel, { x: 16, y: 3 });
  return surface;
}

function createTooSmallFrame(columns: number, rows: number) {
  const frame = new Surface(FRAME_SIZE.width, FRAME_SIZE.height, createCell(" ", {
    background: rgbColor(10, 10, 16)
  }));
  frame.drawText({ x: 2, y: 2 }, "rndr-2d feature zoo", {
    foreground: ansiColor(255),
    bold: true
  });
  frame.drawText({ x: 2, y: 5 }, "Terminal is smaller than 80x24.", {
    foreground: ansiColor(196),
    bold: true
  });
  frame.drawText({ x: 2, y: 7 }, `Current size: ${columns}x${rows}`, {
    foreground: ansiColor(250)
  });
  frame.drawText({ x: 2, y: 8 }, "Resize the terminal or use the non-interactive demos.", {
    foreground: ansiColor(250)
  });
  return frame;
}

export function createInitialZooState(): ZooState {
  return {
    page: "play",
    selector: { q: 2, r: 1 },
    playerCoord: { q: 0, r: 1 },
    playerFacing: "ne",
    autoplay: true,
    showStars: true,
    showPulse: true,
    showTrail: true,
    showContentBoxes: false,
    showHelp: false,
    showDebug: true,
    scaleIndex: 0,
    paletteIndex: 0
  };
}

export function buildZooFrame(input: ZooFrameInput & { terminalColumns: number; terminalRows: number }) {
  if (input.terminalColumns < FRAME_SIZE.width || input.terminalRows < FRAME_SIZE.height) {
    return createTooSmallFrame(input.terminalColumns, input.terminalRows);
  }

  const pageFrame =
    input.state.page === "play"
      ? createPlayPage(input)
      : input.state.page === "hex"
        ? createHexPage(input)
        : input.state.page === "style"
          ? createStylePage(input)
          : createGlowPage(input);

  const stats = summarizeSurface(pageFrame);
  pageFrame.drawText({ x: 2, y: 0 }, "rndr-2d feature zoo", {
    foreground: ansiColor(255),
    bold: true
  });
  pageFrame.drawText(
    { x: 24, y: 0 },
    `${input.state.page.toUpperCase()}  fps ${input.fps}  frame ${input.frameNumber}`,
    {
      foreground: ansiColor(250)
    }
  );

  if (input.state.showDebug) {
    const diffLabel = input.previousDiff
      ? `diff ${input.previousDiff.changedCellCount} cells / ${input.previousDiff.changedRunCount} runs`
      : "diff first frame";
    pageFrame.drawText({ x: 2, y: FRAME_SIZE.height - 1 }, diffLabel, {
      foreground: ansiColor(244)
    });
    pageFrame.drawText({ x: 39, y: FRAME_SIZE.height - 1 }, `visible ${stats.nonBlankGlyphCellCount}`, {
      foreground: ansiColor(118),
      bold: true
    });
  }

  if (input.state.showHelp) {
    pageFrame.blit(createHelpOverlay(), { x: 0, y: 0 });
  }

  return pageFrame;
}
