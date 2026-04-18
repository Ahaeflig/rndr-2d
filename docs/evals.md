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
- Scaled hex layouts preserve predictable step sizes and content-box geometry.
- Parametric hex scaling keeps a single clean outer outline instead of repeated
  border strokes.
- Larger hexes expose additional usable row-span interior for text, not just a
  scaled safe rectangle.

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
