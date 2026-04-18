# rndr-2d

Terminal-first 2D rendering primitives for text games.

The goal is not to build a full widget framework. The goal is to make CLI game
rendering feel like working with actual rendering primitives:

- cells with style instead of ad-hoc ANSI strings
- immutable sprites instead of hand-built string arrays
- composited layers instead of one-off paint order
- reusable geometry such as hex grids instead of game-local projection code
- a thin ANSI backend instead of terminal state leaking through the whole engine

The first consumer target is `~/projects/agent-game`, which already has a
working but bespoke hex/CLI renderer. `rndr-2d` starts by extracting the
reusable ideas behind that renderer and turning them into a small, testable
library.

## Current Scope

The initial scaffold includes:

- `Cell`, `CellStyle`, and color primitives
- mutable `Surface` buffers
- immutable `Sprite` rasters
- scene/layer composition
- ANSI frame serialization and diff rendering
- quarter-turn sprite rotation with glyph remapping
- a reusable hex-grid primitive with label projection
- six-way hex-facing helpers for projected terminal movement
- compatibility helpers for long-form hex facing names used by consumers
- parametric hex scaling and multi-line hex content boxes

Current non-goals for this first cut:

- terminal input handling
- frame scheduling or game loops
- arbitrary-angle sprite rotation
- wide-grapheme layout correctness beyond width-1 terminal cells
- opinionated ECS, state management, or gameplay architecture

## Quick Start

```bash
pnpm install
pnpm check
pnpm demo:zoo
pnpm demo:live
pnpm demo:overview
pnpm demo:review
pnpm review:artifacts
```

## Example

```ts
import {
  Sprite,
  Surface,
  ansiColor,
  composeScene,
  createCell,
  createHexGridSprite,
  drawHexLabel,
  renderSurfaceAnsi
} from "rndr-2d";

const board = createHexGridSprite({
  board: { cols: 4, rows: 3 },
  fill: ({ q, r }) => ((q + r) % 2 === 0 ? "." : ":")
});

const unit = Sprite.fromText({
  lines: [" /^\\\\ ", "<@@>", " \\\\/ "],
  transparentGlyphs: [" "],
  style: {
    foreground: ansiColor(214),
    bold: true
  }
}).rotateQuarterTurns(1);

const frame = composeScene({
  size: { width: 34, height: 18 },
  background: createCell(" "),
  layers: [
    {
      name: "board",
      z: 0,
      items: [{ source: board, position: { x: 0, y: 0 } }]
    },
    {
      name: "unit",
      z: 1,
      items: [{ source: unit, position: { x: 10, y: 5 } }]
    }
  ]
});

drawHexLabel(frame, {
  coord: { q: 1, r: 1 },
  text: "A1"
});

process.stdout.write(renderSurfaceAnsi(frame));
```

## Project Layout

- [AGENTS.md](/home/ahaeflig/projects/rndr-2d/AGENTS.md): agent operating notes for this repo
- [docs/architecture.md](/home/ahaeflig/projects/rndr-2d/docs/architecture.md): core rendering model
- [docs/architecture-illustrated.md](/home/ahaeflig/projects/rndr-2d/docs/architecture-illustrated.md): ASCII architecture diagrams
- [docs/roadmap.md](/home/ahaeflig/projects/rndr-2d/docs/roadmap.md): staged plan
- [docs/evals.md](/home/ahaeflig/projects/rndr-2d/docs/evals.md): invariants and quality criteria
- [docs/research.md](/home/ahaeflig/projects/rndr-2d/docs/research.md): outside inspirations and takeaways

## Review Commands

- `pnpm demo:zoo`: keyboard-driven feature zoo for manual testing of pages, colors, layers, animation, 6-way hex facing, and parametric hex scaling
- `pnpm demo:live`: animated terminal renderer with alt-screen, diff updates, motion, colors, layers, and a rotation gallery
- `pnpm demo:overview`: small color demo
- `pnpm demo:review`: richer two-frame review showcase with ANSI, plain snapshots, axes, and diff/debug output
- `pnpm review:artifacts`: generates review files in `docs/generated/`

Feature zoo controls:

- `1` / `2` / `3` or `Tab`: switch between play, hex lab, and style lab
- arrow keys or `HJKL`: move the active selector
- `Enter`: move the player ship to the selected hex on the play page
- `Q` / `E`: rotate the player ship through 6 hex facings
- `Space`: toggle autoplay
- `P` / `T` / `S`: toggle pulse, trail, and stars
- `[` / `]`: shrink or enlarge hexes in the hex lab
- `B`: toggle usable-row markers for hex text regions
- `C`: cycle palettes
- `D`: toggle the debug footer
- `R`: reset the demo state
- `?`: show the in-demo help overlay

Live demo flags:

- `pnpm demo:live -- --seconds 10`: run for a fixed duration
- `pnpm demo:live -- --fps 24`: raise target frame rate
- `pnpm demo:live -- --loop`: keep running until `Ctrl-C`
- `pnpm demo:live -- --no-alt`: avoid alt-screen, useful when capturing output

## Hex Scaling

The hex module is now explicitly parametric. The core exports include:

- `scaleHexLayout(layout, scale)`: enlarge a layout by an integer scale factor
- `HEX_FACINGS`, `rotateHexFacing(...)`: represent and cycle through the six facings of the pointy hex projection
- `HEX_FACING_NAMES`, `normalizeHexFacing(...)`, `hexFacingName(...)`: bridge between canonical short ids (`n`, `ne`, ...) and consumer-friendly names (`north`, `northEast`, ...)
- `hexFacingFromScreenDelta(...)`: classify projected movement into one of the six hex facings
- `mapHexFacings(...)`, `createHexFacingSpriteSet(...)`, `getHexFacingValue(...)`: build reusable facing-indexed assets without rewriting the same six-way boilerplate
- `projectHexContentBox(layout, coord)`: find a conservative rectangular text box inside a hex
- `projectHexContentRows(layout, coord)`: find the full shaped row-by-row text spans inside a hex
- `drawHexTextBlock(...)`: render clipped/aligned multi-line content across the full usable hex interior
- `drawTextBlockInRect(...)`: render aligned text into any rectangular region
- `drawTextBlockInRows(...)`: render aligned text across arbitrary row spans

The fastest proof path is `pnpm demo:zoo`, then switch to page `2` and use `[` / `]`.
Larger scales are generated as clean pointy hexes with single-cell borders rather
than nearest-neighbor duplication of the base raster.

## Consumer Notes

`rndr-2d` keeps canonical hex ids short inside the renderer (`n`, `ne`, `se`,
`s`, `sw`, `nw`), but accepts long-form names when that matches consumer
contracts better:

```ts
normalizeHexFacing("northEast"); // "ne"
rotateHexFacing("southWest", 1); // "nw"
```

That should make `agent-game` integration less noisy, because its existing
contracts and CLI renderer already use `north`, `northEast`, `southEast`,
`south`, `southWest`, and `northWest`.

The package also runs `pnpm build` from `prepare`, so a branch or git
dependency has the `dist/` artifacts it exports without requiring a separate
manual build step first.
