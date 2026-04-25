# Spec: Perspective Hex Grid

Draft proposal for adding foreshortened hex-grid rendering to `rndr-2d`. For
review, not yet scheduled. Prototype lives in
`agent-game/tmp/braille-hex-demo.ts` and proved the approach works on a
fixed text grid.

## Motivation

`createHexGridSprite` currently builds a uniformly-sized pointy-hex board —
every rank uses the same `HexLayout`, so the result reads as a flat top-down
plan. Consumers (`agent-game` first, probably not last) want a 3/4 "tilted
back" look where rear ranks visibly recede into the distance, without
leaving the character grid.

True 3D projection is out of scope and would require non-integer cell
geometry. The prototype showed that a **per-rank scaled-layout stack** gives
a convincing perspective illusion on the text grid: each rank renders as its
own `createHexGridSprite` strip at a different integer scale, stacked
vertically with merged rims and centered on a shared vanishing X.

## Scope Question

This is a **grid layout** feature, not a new rendering paradigm. It belongs
in `rndr-2d` alongside the existing hex helpers:

- It reuses `HexLayout`, `createHexGridSprite`, `projectHexCenter`, and
  `projectHexContentRows` verbatim.
- It introduces no new sprite/surface concepts.
- The output is still an ordinary `Sprite` the consumer blits onto a
  `Surface`.

Renaming the package is not warranted. `rndr-2d` remains a terminal 2D
renderer; perspective hex is a stylistic option on top of the existing 2D
pipeline, same as braille is a stylistic option on top of the existing cell
pipeline.

## Proposed API

```ts
export interface PerspectiveHexGridInput {
  board: HexBoardSize;
  /** Scale used for the near-viewer rank (bottom row). Integer, ≥ 1. */
  nearScale: number;
  /**
   * How many scale steps to shed per rank going back. Default 1. Clamped so
   * no rank falls below scale 1. Fractional values are rejected.
   */
  rankStep?: number;
  /**
   * Base template fed through `scaleHexLayout` for each rank. Defaults to
   * `DEFAULT_HEX_TILE_TEMPLATE`. Custom templates (different fill glyph,
   * alternative silhouette) flow through unchanged.
   */
  baseLayout?: HexLayout;
  /** Per-coord fill glyph, same contract as `createHexGridSprite`. */
  fill?: string | ((coord: AxialCoord) => string);
  fillStyle?: CellStyle | ((coord: AxialCoord) => CellStyle);
  borderStyle?: CellStyle | ((coord: AxialCoord) => CellStyle);
  edgePriority?: (coord: AxialCoord) => number;
  /**
   * How neighbouring rank strips are joined vertically.
   * - "merge-rim" (default): overlap by 1 row so the `\____/` of the rank
   *   in front lines up with the `____` of the rank behind.
   * - "stack": no overlap; ranks sit on top of each other with a 1-row
   *   border gap.
   */
  seam?: "merge-rim" | "stack";
}

export interface PerspectiveHexRank {
  /** Axial r of this rank within the source board. */
  row: number;
  /** The layout at which this rank was rendered. */
  layout: HexLayout;
  /** Top-left of the rank strip within the composed sprite. */
  origin: Point;
  /** Strip width/height inside the composed sprite. */
  size: Size;
}

export interface PerspectiveHexGrid {
  sprite: Sprite;
  size: Size;
  ranks: readonly PerspectiveHexRank[];
  /**
   * Project a board coord to a pixel (cell) inside the composed sprite.
   * Hides the rank-lookup arithmetic from consumers.
   */
  projectCenter(coord: AxialCoord): Point;
  projectContentBox(coord: AxialCoord): Rect;
  projectContentRows(coord: AxialCoord): readonly Rect[];
}

export function createPerspectiveHexGrid(
  input: PerspectiveHexGridInput
): PerspectiveHexGrid;
```

### Design notes

- **Integer scales only.** Keeps every cell aligned to the character grid
  and lets us keep using `scaleHexLayout` unchanged. Small boards (3-5
  ranks) get three distinct sizes which is enough to sell perspective; very
  tall boards flatten because the scale bottoms out at 1. That's an
  acceptable first cut — a future `nonlinearRankStep` option can address
  it.
- **Centered on vanishing X.** Each rank strip is horizontally centered on
  `floor(maxStripWidth / 2)`. The result is symmetric. A future
  `vanishingX` override could place the horizon off-center for dramatic
  shots.
- **Seam handling.** The prototype's 1-row overlap works because the
  pointy-hex template dedicates its last row to `\____/` and its first row
  to `____` — identical glyphs, so overwriting is lossless. If a consumer
  supplies a custom template where the first and last rows differ, the
  default `"merge-rim"` mode will look wrong; `"stack"` is the escape
  hatch.
- **Projector hides the math.** Consumers currently have to track
  `rank.originX + projectHexCenter(rank.layout, {q, r: 0}).x` themselves.
  Exposing `grid.projectCenter(coord)` removes that boilerplate and keeps
  the rank-to-layout mapping internal.

## Non-Goals (v1)

- Non-integer scales. Doable later by pre-rendering content at a higher
  resolution and resampling, but it's a different feature.
- Camera rotation beyond "looking north from the south". The board's q
  axis is still horizontal.
- Depth shading (fog, per-tile gradient). These are app-level concerns —
  the existing `fillStyle(coord)` / `borderStyle(coord)` callbacks already
  give consumers everything they need.
- Entity placement / sprite anchoring helpers. The projector returns
  coordinates; anchoring a unit on the hex is the consumer's call.

## Migration

Additive. `createHexGridSprite` is unchanged and stays the right choice for
top-down maps, debug views, and tests. `createPerspectiveHexGrid` is a new
function that consumers opt into when they want the tilted look.

## Open Questions

1. **Bottom-up vs top-down in input.** The prototype treats `r=0` as rear
   because that's what `agent-game` already does. Worth confirming that's
   the expected convention, or whether a `nearSide: "bottom" | "top"`
   option makes sense.
2. **Seam overlap on custom templates.** Should `"merge-rim"` inspect the
   template's first/last rows and bail to `"stack"` automatically if they
   don't match, or always trust the consumer?
3. **Bevel / ground-contact helpers.** The prototype tried a braille bevel
   and dropped it because it overdrew rim glyphs. A thin upstream primitive
   — `drawHexBevel(surface, rank, coord, style)` or a ground ellipse that
   takes a `HexLayout` + `AxialCoord` and picks sensible defaults — would
   save every consumer the dot-math. Worth a sibling spec, not in scope
   here.
4. **Upstream bug surfaced by the prototype.** `brailleDotPointFromCell(p,
   "center")` returns half-dot coords (e.g. `96.5, 101.5`). `paintDot`
   indexes arrays by `y * width + x` with no rounding, so fractional writes
   silently vanish. Either round inside `paintDot` or document that
   callers must. Not a perspective-hex concern per se, but the prototype
   tripped on it and a user-facing spec here is a natural place to flag it.

## Example

```ts
import {
  createPerspectiveHexGrid,
  rgbColor
} from "rndr-2d";

const grid = createPerspectiveHexGrid({
  board: { cols: 7, rows: 5 },
  nearScale: 4,
  fill: ({ r }) => (r === 0 ? " " : "."),
  fillStyle: ({ r }) => ({
    foreground: rgbColor(60 + r * 30, 70 + r * 30, 90 + r * 20)
  }),
  borderStyle: { foreground: rgbColor(190, 200, 220) }
});

// Rank scales automatically: [1, 2, 3, 4, 4] because rankStep=1 and the
// clamp locks the rear two ranks to scale 1.

surface.blit(grid.sprite, { x: 0, y: 0 });
const center = grid.projectCenter({ q: 3, r: 2 });
surface.blit(unitSprite, {
  x: center.x - (unitSprite.width >> 1),
  y: center.y - (unitSprite.height >> 1)
});
```
