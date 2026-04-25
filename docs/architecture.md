# Architecture

## Design Goals

`rndr-2d` should make terminal game rendering feel like real rendering work,
not string concatenation with ANSI escape codes mixed in.

The initial design optimizes for:

- deterministic pure rendering
- testable frame composition
- portability across terminals that support normal ANSI cursor control
- reuse across multiple games, with `agent-game` as the first hard consumer
- a small surface area that can grow without forcing a rewrite

## Core Model

### 1. Cells

A `Cell` is the atomic render unit:

- one glyph intended to occupy one terminal cell
- optional style data
- no terminal escape codes embedded in the glyph

This is the key constraint that keeps the rest of the system composable.

### 2. Surfaces

A `Surface` is a mutable 2D cell buffer used for composition:

- set and read cells by coordinate
- draw text blocks
- blit any raster source onto the buffer
- use `null` cells for transparency

Surfaces are the workhorse for building a frame.

### 3. Sprites

A `Sprite` is an immutable raster:

- parsed from text or another raster source
- transparent by default where desired
- safe to reuse across frames
- transformable without mutating the original

This is where reusable ASCII/Unicode art should live.

### 4. Scene Composition

Layering is explicit:

- a scene has a size, optional background, and ordered layers
- each layer contains positioned raster items
- the compositor resolves visibility and z-order into a final `Surface`

This keeps consumer rendering code declarative without forcing a full retained
UI framework.

### 5. ANSI Backend

ANSI rendering is a backend adapter:

- serialize a full surface to terminal output
- serialize a diff when a previous frame exists
- keep cursor movement and SGR style generation isolated from the scene model

The rest of the library should not care whether the consumer writes to a real
TTY, logs snapshots, or tests string output.

### 6. Geometry Primitives

Game-specific geometry belongs in modules that still compose through the same
cell model.

The first geometry primitive is a hex-grid projector:

- template-driven tile drawing
- coordinate projection from axial board space to terminal cells
- helper labeling at tile centers
- six-way facing helpers derived from projected terminal movement
- canonical short facing ids plus long-form compatibility for consumer contracts
- scalable layouts that can generate larger pointy hexes from the same base geometry
- conservative content boxes plus full row-span content regions for multi-line text inside larger hexes

That gives `agent-game` a path away from hand-maintained console board code
without making hexes a special case of the whole library.

### 7. Dense Graphics Extensions

Some terminal graphics benefit from denser sampling than one authored glyph per
cell. `rndr-2d` now supports that through optional raster extensions that still
compile back into normal terminal cells.

The first dense path is a braille micro-raster:

- author in micro-dot coordinates rather than cell coordinates
- compile each `2x4` dot block into one Unicode braille cell
- preserve the normal `RasterSource` contract at the composition boundary
- keep dense graphics opt-in so labels and UI remain readable

This is intentionally an extension, not a rewrite of the core unit. The atomic
unit of composition is still a terminal cell; braille is a way to generate
better graphics cells, not a reason to redefine what a `Cell` means.

`DenseLightSurface` builds on that path for terminal-native glow:

- accumulate RGB light energy in braille dot space
- paint halos, rings, lines, polygons, ellipses, circles, and sparse sparkle fields
- compile continuous energy fields into dithered braille dots
- optionally map light energy through color ramps
- use hash or ordered Bayer dithering for different falloff textures
- emit background-only glow cells for low-energy light fields
- keep glow deterministic and snapshot-friendly

This is still not true optical bloom. It is a text-mode approximation that uses
contrast, sparse activation, RGB ramps, and braille density to make bright
effects read as luminous without leaving normal ANSI rendering.

`HalfBlockLightSurface` explores a different tradeoff:

- store two vertical light samples per terminal cell
- compile them with `▀`/`▄` using foreground and background colors
- paint the same core light primitives, including rings and halos
- give up braille-level shape detail in exchange for smoother color gradients

This is useful for larger glows, soft auras, and background light fields where
color continuity matters more than tiny point detail.

`HybridLightSurface` combines both tradeoffs:

- render soft color mass with `HalfBlockLightSurface`
- render crisp highlights with `DenseLightSurface`
- merge the detail glyph over the soft layer while preserving the soft
  background color

Temporal helpers such as `lightPulse` and `lightShimmerSeed` stay pure. They do
not own frame loops; they just make animated glow parameters deterministic.

### 8. Projection Helpers

Projection helpers map simple 3D world coordinates into the existing continuous
screen-cell coordinate system:

- look-at perspective projection for tilted worlds where distance changes scale
- look-at orthographic projection for fixed Pokemon-like camera angles
- projected braille points, lines, polygons, plane circles, and billboards
- projected dense-light dots, lines, and plane rings

These helpers do not introduce a scene graph, z-buffer, or terminal runtime.
They are pure geometry plus explicit raster writes into `BrailleSurface` or
`DenseLightSurface`, so the composed result still flows through the normal
`RasterSource` and `Surface` APIs.

## Public Boundaries

### Core

These abstractions should remain stable and generic:

- colors and styles
- cells
- raster sources
- surfaces
- sprites
- scene composition
- ANSI serialization

### Extensions

These are allowed to be opinionated if they are still reusable across games:

- hex layouts
- hex facing maps and sprite sets
- dense raster compilers such as braille surfaces
- 3D-to-cell projection helpers for braille geometry and dense light
- sprite glyph remappers for rotation
- tile templates
- animation helpers based on pure interpolation

### Out Of Scope For Now

- input handling
- layout widgets
- rich text parsing
- arbitrary-angle transforms
- terminal capability probing
- networking or multiplayer presentation policy

## Direction

The next architectural layer after this scaffold should likely be pure
animation/time helpers:

- interpolation between projected positions
- sprite frame selection over time
- transient effect composition
- damage flashes, trails, and cue overlays

That work should build on the current raster model instead of bypassing it.
