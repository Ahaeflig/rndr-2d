# Roadmap

## Phase 0: Foundation

Shipped in this scaffold:

- project bootstrap files
- architecture docs
- style/cell primitives
- raster composition
- ANSI serialization
- sprite rotation by quarter turns
- initial hex-grid module

## Phase 1: Consumer Extraction

Target: replace the most reusable pieces of `agent-game` console rendering with
`rndr-2d`.

Likely work:

- model one `agent-game` board frame entirely through `Surface`/`Sprite`
- port hex board background generation
- port unit token and overlay composition
- add missing primitives discovered during the port

## Phase 2: Animation Primitives

Target: make animated terminal rendering straightforward.

Likely work:

- timelines and keyframes
- position interpolation helpers
- simple effect layers
- sprite-sheet or frame-set helpers for text sprites
- reusable transition composition

## Phase 3: Terminal Runtime Adapter

Target: better ergonomics for full-screen terminal apps without polluting core
rendering primitives.

Likely work:

- alt-screen session helpers
- frame pacing helpers
- resize handling hooks
- optional higher-level renderer loop

## Phase 4: Richer Geometry And Effects

Possible directions:

- isometric templates
- tilemap helpers
- lighting and fog approximations in text
- particle-style effects
- palette utilities

