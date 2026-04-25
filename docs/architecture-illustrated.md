# Architecture Illustrated

This is the quick visual review of how `rndr-2d` is intended to work.

## Rendering Pipeline

```text
authoring time
=============

text art / tile templates / HUD text
        |
        v
  +------------+
  |   Sprite   |  immutable raster source
  +------------+
        |
        | placed into
        v
  +------------+      +------------+      +------------+
  |  Layer 0   | ---> |  Layer 1   | ---> |  Layer N   |
  +------------+      +------------+      +------------+
        \                  |                    /
         \                 |                   /
          \                v                  /
           +--------------------------------+
           |         composeScene()         |
           +--------------------------------+
                          |
                          v
                   +-------------+
                   |   Surface   | mutable frame buffer
                   +-------------+
                          |
                 +--------+--------+
                 |                 |
                 v                 v
      renderSurfacePlain()   renderSurfaceAnsi()
         review/debug            terminal output
```

## Why The Surface Exists

```text
without a surface buffer:

sprite -> ANSI string
board  -> ANSI string
HUD    -> ANSI string

Now composition depends on string order, cursor movement, and terminal state.
That makes tests brittle and layering hard.

with a surface buffer:

sprite -> raster
board  -> raster
HUD    -> raster
           |
           v
       compose into one surface
           |
           +--> plain debug snapshot
           +--> ANSI frame
           +--> diff against previous frame
```

## Hex Consumer Path

```text
agent-game board state
        |
        v
axial coords + unit state
        |
        +--> createHexGridSprite()
        |
        +--> projectHexCenter()
        |
        +--> unit Sprite / token selection
        |
        v
   layered scene
        |
        v
     Surface
        |
        v
   ANSI terminal frame
```

## Dense Light Path

```text
light authoring
===============

circle / ring / halo / line / polygon
        |
        v
  +-------------------+
  | additive RGB grid |
  +-------------------+
        |
        +--> DenseLightSurface ----> braille dots for crisp detail
        |
        +--> HalfBlockLightSurface -> upper/lower color samples
        |
        +--> HybridLightSurface ---> soft base + crisp highlights
        |
        v
    RasterSource
        |
        v
      Surface
        |
        v
  ANSI terminal frame
```

```text
one terminal cell
=================

braille detail:           half-block color:

  2x4 dots                  upper sample -> foreground
  compile to ⣿             lower sample -> background or foreground

  useful for shape          useful for smooth glow
```

## Review Checklist

- `Cell` owns glyph + style, never ANSI bytes.
- `Sprite` is reusable and transformable.
- `Surface` is the composition target.
- ANSI rendering is the final serialization step.
- Geometry helpers such as hexes still go through the same raster model.
- Glow helpers still compile to `RasterSource` objects before composition.
