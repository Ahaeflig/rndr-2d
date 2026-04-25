# Evals

These are the initial quality criteria for the library.

## Correctness Invariants

- Layer composition is deterministic for identical scene inputs.
- Transparent sprite cells do not overwrite existing cells.
- `renderSurfaceDiffAnsi` falls back to full rendering when frame dimensions
  change.
- Quarter-turn rotation preserves occupancy and remaps directional glyphs
  consistently.
- Hex projection produces stable center points for the same layout and
  coordinates.
- Six-way hex-facing classification remains stable for equivalent projected
  movement deltas.
- Long-form consumer-facing hex names normalize to the same canonical facings
  as short internal ids.
- Scaled hex layouts preserve predictable step sizes and content-box geometry.
- Parametric hex scaling keeps a single clean outer outline instead of repeated
  border strokes.
- Larger hexes expose additional usable row-span interior for text, not just a
  scaled safe rectangle.
- Dense braille rasters compile deterministically into the same cell output for
  identical micro-dot input.
- Dense light rasters accumulate RGB energy additively before compiling to
  terminal cells.
- Dithered glow compilation remains deterministic for a fixed seed and avoids
  converting bright fields into accidental solid blocks.
- Ordered glow dithering remains deterministic and distinct from hash-noise
  dithering.
- Light color ramps map energy to predictable terminal RGB output.
- Background-only glow cells can carry low-energy light without emitting a
  foreground glyph.
- Half-block light rasters can represent distinct upper and lower color samples
  in a single terminal cell.
- Hybrid light rasters preserve soft half-block background color underneath
  dense braille highlights.
- Temporal glow helpers are pure functions of frame inputs.
- Dense raster extensions remain composable through the normal `RasterSource`
  and `Surface` APIs instead of bypassing the engine.

## Test Requirements

Every new primitive should normally ship with at least one of:

- a deterministic unit test over cell output
- a frame snapshot test over string output
- a geometry/projection test for spatial helpers

## Success Criteria For Early Iteration

- `agent-game` can adopt the core board primitives without losing current CLI
  behavior.
- Most rendering code in the consumer becomes composition of reusable
  primitives instead of bespoke loops.
- ANSI generation remains isolated enough that alternate backends remain
  possible later.
