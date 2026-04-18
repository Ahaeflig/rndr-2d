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
- scalable layouts that can generate larger pointy hexes from the same base geometry
- conservative content boxes plus full row-span content regions for multi-line text inside larger hexes

That gives `agent-game` a path away from hand-maintained console board code
without making hexes a special case of the whole library.

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
