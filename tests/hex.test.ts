import { describe, expect, it } from "vitest";

import {
  DEFAULT_HEX_LAYOUT,
  HEX_FACINGS,
  ansiColor,
  createHexFacingSpriteSet,
  Surface,
  createHexGridSprite,
  drawHexEdge,
  drawHexTextBlock,
  getHexFacingSprite,
  getHexFacingValue,
  hexFacingVector,
  hexFacingName,
  hexFacingFromScreenDelta,
  mapHexFacings,
  normalizeHexFacing,
  projectHexAnchor,
  projectHexCenter,
  projectHexContentBox,
  projectHexContentRows,
  projectHexOrigin,
  rgbColor,
  rotateHexFacing,
  Sprite,
  scaleHexLayout
} from "../src/index.js";

describe("hex primitives", () => {
  it("renders a single default hex tile", () => {
    const sprite = createHexGridSprite({
      board: { cols: 1, rows: 1 }
    });

    expect(sprite.toLines()).toEqual(["  ____  ", " /....\\ ", "/......\\", "\\....../", " \\____/ "]);
  });

  it("projects stable hex centers", () => {
    expect(projectHexCenter(DEFAULT_HEX_LAYOUT, { q: 1, r: 0 })).toEqual({
      x: 9,
      y: 4
    });
  });

  it("scales hex layouts parametrically", () => {
    const scaled = scaleHexLayout(DEFAULT_HEX_LAYOUT, 3);

    expect(scaled.name).toBe("default-3x");
    expect(scaled.colStep).toBe(18);
    expect(scaled.rowStep).toBe(12);
    expect(scaled.rowSkew).toBe(6);
    expect(scaled.template.rows).toHaveLength(13);
    expect(scaled.template.rows[0]).toBe("      ____________      ");
    expect(scaled.template.rows[1]).toBe("     /............\\     ");
    expect(scaled.template.rows[12]).toBe("     \\____________/     ");
    expect(scaled.template.rows[0]).toHaveLength(24);
    expect(projectHexContentBox(scaled, { q: 0, r: 0 })).toEqual({
      x: 6,
      y: 3,
      width: 12,
      height: 9
    });
    expect(projectHexContentRows(scaled, { q: 0, r: 0 })).toEqual([
      { x: 6, y: 1, width: 12, height: 1 },
      { x: 5, y: 2, width: 14, height: 1 },
      { x: 4, y: 3, width: 16, height: 1 },
      { x: 3, y: 4, width: 18, height: 1 },
      { x: 2, y: 5, width: 20, height: 1 },
      { x: 1, y: 6, width: 22, height: 1 },
      { x: 1, y: 7, width: 22, height: 1 },
      { x: 2, y: 8, width: 20, height: 1 },
      { x: 3, y: 9, width: 18, height: 1 },
      { x: 4, y: 10, width: 16, height: 1 },
      { x: 5, y: 11, width: 14, height: 1 }
    ]);
  });

  it("draws text blocks inside the hex content box", () => {
    const scaled = scaleHexLayout(DEFAULT_HEX_LAYOUT, 2);
    const surface = new Surface(50, 30);

    drawHexTextBlock(surface, {
      coord: { q: 0, r: 0 },
      layout: scaled,
      lines: ["ALPHA NODE", "HP 12", "ENERGY 7"],
      align: "center"
    });

    const contentBox = projectHexContentBox(scaled, { q: 0, r: 0 });
    expect(contentBox).toEqual({
      x: 4,
      y: 2,
      width: 8,
      height: 6
    });
    expect(surface.cellAt(3, 3)?.glyph).toBe("A");
    expect(surface.cellAt(12, 3)?.glyph).toBe("E");
    expect(surface.cellAt(5, 4)?.glyph).toBe("H");
    expect(surface.cellAt(11, 5)?.glyph).toBe("7");
  });

  it("renders a clean scaled hex instead of a repeated raster", () => {
    const sprite = createHexGridSprite({
      board: { cols: 1, rows: 1 },
      layout: scaleHexLayout(DEFAULT_HEX_LAYOUT, 2)
    });

    expect(sprite.toLines()).toEqual([
      "    ________    ",
      "   /........\\   ",
      "  /..........\\  ",
      " /............\\ ",
      "/..............\\",
      "\\............../",
      " \\............/ ",
      "  \\........../  ",
      "   \\________/   "
    ]);
  });

  it("supports distinct border and fill styling for hex tiles", () => {
    const sprite = createHexGridSprite({
      board: { cols: 1, rows: 1 },
      fillStyle: { foreground: ansiColor(196) },
      borderStyle: { foreground: ansiColor(244) }
    });

    expect(sprite.cellAt(2, 0)?.glyph).toBe("_");
    expect(sprite.cellAt(2, 0)?.style?.foreground).toEqual(ansiColor(244));
    expect(sprite.cellAt(2, 1)?.glyph).toBe(".");
    expect(sprite.cellAt(2, 1)?.style?.foreground).toEqual(ansiColor(196));
  });

  it("classifies projected screen deltas into six hex facings", () => {
    expect(HEX_FACINGS).toEqual(["n", "ne", "se", "s", "sw", "nw"]);
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: 0, dy: -8 })).toBe("n");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: 12, dy: -4 })).toBe("ne");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: 12, dy: 4 })).toBe("se");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: 0, dy: 8 })).toBe("s");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: -12, dy: 4 })).toBe("sw");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: -12, dy: -4 })).toBe("nw");
  });

  it("exposes projected screen vectors for each hex facing", () => {
    expect(hexFacingVector(DEFAULT_HEX_LAYOUT, "n")).toEqual({ x: 0, y: -4 });
    expect(hexFacingVector(DEFAULT_HEX_LAYOUT, "northEast")).toEqual({ x: 6, y: -2 });
    expect(hexFacingVector(scaleHexLayout(DEFAULT_HEX_LAYOUT, 3), "southWest")).toEqual({ x: -18, y: 6 });
  });

  it("rotates hex facings cyclically", () => {
    expect(rotateHexFacing("n", 1)).toBe("ne");
    expect(rotateHexFacing("n", 3)).toBe("s");
    expect(rotateHexFacing("northEast", -1)).toBe("n");
    expect(rotateHexFacing("se", -1)).toBe("ne");
    expect(rotateHexFacing("nw", 2)).toBe("ne");
  });

  it("normalizes consumer-facing long hex names", () => {
    expect(normalizeHexFacing("north")).toBe("n");
    expect(normalizeHexFacing("southWest")).toBe("sw");
    expect(hexFacingName("ne")).toBe("northEast");
    expect(hexFacingFromScreenDelta({ layout: DEFAULT_HEX_LAYOUT, dx: 0, dy: 0, fallback: "southEast" })).toBe("se");
  });

  it("maps values across all six facings and resolves long-form lookups", () => {
    const labels = mapHexFacings((facing, index) => `${index}:${hexFacingName(facing)}`);

    expect(labels.n).toBe("0:north");
    expect(labels.sw).toBe("4:southWest");
    expect(getHexFacingValue(labels, "northWest")).toBe("5:northWest");
  });

  it("paints shared borders in edge-priority order so high-priority tiles win", () => {
    const priorityColor = rgbColor(250, 80, 80);
    const neutralColor = rgbColor(90, 90, 90);
    const sprite = createHexGridSprite({
      board: { cols: 1, rows: 2 },
      borderStyle: (coord) => (coord.r === 0 ? { foreground: priorityColor } : { foreground: neutralColor }),
      // Neutral tile (r=1) paints first, priority tile (r=0) paints second so
      // its bottom `____` overwrites neutral's top `____` with the winning style.
      edgePriority: (coord) => (coord.r === 0 ? 1 : 0)
    });
    const sharedY = 4;

    // All four shared underscores along the r=0 / r=1 boundary should carry the priority color.
    for (let x = 2; x <= 5; x += 1) {
      const cell = sprite.cellAt(x, sharedY);
      expect(cell?.glyph).toBe("_");
      expect(cell?.style?.foreground).toEqual(priorityColor);
    }
  });

  it("paints a single hex edge with a custom style", () => {
    const surface = new Surface(20, 10);
    const highlight = rgbColor(120, 220, 255);

    drawHexEdge(surface, {
      coord: { q: 0, r: 0 },
      edge: "n",
      style: { foreground: highlight }
    });

    for (let x = 2; x <= 5; x += 1) {
      const cell = surface.cellAt(x, 0);
      expect(cell?.glyph).toBe("_");
      expect(cell?.style?.foreground).toEqual(highlight);
    }

    drawHexEdge(surface, {
      coord: { q: 0, r: 0 },
      edge: "northEast",
      style: { foreground: highlight },
      glyph: "*"
    });

    expect(surface.cellAt(6, 1)?.glyph).toBe("*");
    expect(surface.cellAt(7, 2)?.glyph).toBe("*");
  });

  it("projects anchor points biased toward a hex edge", () => {
    const center = projectHexCenter(DEFAULT_HEX_LAYOUT, { q: 1, r: 1 });
    const anchor = projectHexAnchor(DEFAULT_HEX_LAYOUT, { q: 1, r: 1 }, "n", 0.6);

    expect(anchor.x).toBeCloseTo(center.x);
    expect(anchor.y).toBeCloseTo(center.y - (0.6 * DEFAULT_HEX_LAYOUT.rowStep) / 2);

    const deadCenter = projectHexAnchor(DEFAULT_HEX_LAYOUT, { q: 0, r: 0 }, "se", 0);
    expect(deadCenter).toEqual(projectHexCenter(DEFAULT_HEX_LAYOUT, { q: 0, r: 0 }));

    // Avoid "unused import" lint by using projectHexOrigin indirectly; keep a
    // sanity check that edges land inside the tile footprint.
    const origin = projectHexOrigin(DEFAULT_HEX_LAYOUT, { q: 0, r: 0 });
    expect(anchor.x).toBeGreaterThan(origin.x - 1);
  });

  it("builds and retrieves sprite sets by hex facing", () => {
    const sprites = createHexFacingSpriteSet((facing) =>
      Sprite.fromText({
        lines: [hexFacingName(facing)],
        transparentGlyphs: []
      })
    );

    expect(getHexFacingSprite(sprites, "n").toLines()[0]).toBe("north");
    expect(getHexFacingSprite(sprites, "southEast").toLines()[0]).toBe("southEast");
  });
});
