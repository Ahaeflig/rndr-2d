# Spec: Camera & Projection

Draft proposal for a shared camera/projection abstraction in `rndr-2d`.
For review, not yet scheduled. Sibling to
[`perspective-hex.md`](./perspective-hex.md), which becomes a thin
consumer of this spec.

## Why now

Two things pushed this:

1. The perspective-hex prototype duplicated rank-projection math the
   library will inevitably want elsewhere (parallax layers, smooth board
   pan, zoom-to-tile, dramatic camera shots).
2. Braille primitives (`paintDot`, `fillCircle`, `drawLine`,
   `strokeCircle`) already operate on continuous coords. They're one step
   away from being "world-space" primitives — they just need a projection
   to flow through.

Without this, every consumer that wants any non-trivial framing rebuilds
the same coord arithmetic. With it, the same camera object can drive
braille effects, sprite anchors, and hex grid layout consistently.

## Scope decision

The proposal commits to **Tier B** from the design discussion: a shared
**camera / anchor projection** that maps world coords to screen cells. It
explicitly does **not** try to resample sprites or text glyphs based on
projected scale — that's Tier C territory and it forces the library to
take an opinionated stand on glyph LOD that would invalidate every
existing consumer.

Other options considered, with the reason they're not the chosen path,
recorded for future-us:

- **Tier A — orthographic forever, no abstraction.** Defensible if you
  believe rndr-2d's job ends at primitives and consumers should own their
  own cameras. Loses out the moment two consumers want the same trick;
  the perspective-hex prototype already proved one trick is duplicating.
- **Tier C — projection-aware rasterization.** Sprites pick a
  pre-rendered LOD based on the projection's local scale; text sprites
  pick a size variant; hex grids stack rank strips internally. Real
  value, real complexity, and "projection-aware text" really means "pick
  the nearest pre-baked scale" — a focused LOD feature that's worth its
  own future spec, not a rendering paradigm. Tier B composes with a
  future Tier C without breaking it.
- **Tier D — true 3D (z-buffer, occlusion, depth sort).** Out of scope.
  Would turn rndr-2d into a tiny 3D engine. Mentioned only so it's
  explicitly off the table.

## Mental model

A `Projection` is a pure function from a continuous point in **world
space** to a continuous point in **screen space** (cells), plus a few
helpers the renderer can ask about it. Screen space is the same
coordinate system the existing primitives already use — top-left origin,
+x right, +y down, one unit = one terminal cell. World space is
whatever the consumer wants — could literally be screen space (identity
projection), could be a hex board's axial coords, could be a 3D-ish
tilted plane.

A `Camera` is a small bundle of state — position, zoom, optional
shake/pan — that the consumer owns. The camera builds a projection that
the renderer applies. Consumers that don't want camera state can build
projections directly; the camera is a convenience over the projection.

Crucially, projections operate in **continuous** coords for both input
and output. The integer-cell rounding happens at the very last step (in
sprite blits and braille's `paintDot`), not inside the projection. This
is what makes the abstraction compose with braille naturally — braille
is sub-cell, so it cares about fractional output.

## Proposed API

### Core projection contract

```ts
export interface Projection {
  /** World point → screen point, both continuous. */
  project(world: Point): Point;
  /** Screen point → world point. Required for input/hit-testing. */
  unproject(screen: Point): Point;
  /**
   * Local linear scale at a world point: how many screen cells per world
   * unit, returned as { x, y } so non-uniform/perspective projections can
   * report different scales per axis. Used by future LOD code; ignored by
   * Tier B consumers.
   */
  scaleAt(world: Point): { x: number; y: number };
}
```

`project` and `unproject` are required to be inverses within the
projection's defined domain. `scaleAt` is advisory — orthographic
projections always return `{ x: 1, y: 1 }`; perspective projections
return smaller values for points farther from the viewer. No primitive
in this spec consumes `scaleAt`; it's defined now so the next spec can
read it without breaking the contract.

### Built-in projections

```ts
/** Identity. Default everywhere. */
export const ORTHOGRAPHIC: Projection;

export interface OrthographicProjectionInput {
  /** World origin that should land at this screen point. Default {0, 0}. */
  anchorScreen?: Point;
  /** World point that should be centered. Default {0, 0}. */
  anchorWorld?: Point;
  /** Uniform world→screen scale. Default 1. */
  zoom?: number;
}
export function createOrthographicProjection(
  input?: OrthographicProjectionInput
): Projection;

export interface LinearPerspectiveProjectionInput {
  /**
   * Y-axis compression as world.y increases. The projected y is
   *   screen.y = anchorScreen.y + (world.y - anchorWorld.y) * yScale(world.y)
   * yScale is a continuous function of world.y. The default linear
   * variant linearly interpolates yScale from `nearScale` at
   * `nearWorldY` down to `farScale` at `farWorldY`.
   */
  nearWorldY: number;
  farWorldY: number;
  nearScale: number;
  farScale: number;
  /** X compression follows yScale (same factor) so things shrink to a vanishing point. */
  vanishingScreenX: number;
  /** Where in screen space the near edge of the world should land. */
  anchorScreen: Point;
}
export function createLinearPerspectiveProjection(
  input: LinearPerspectiveProjectionInput
): Projection;
```

`createOrthographicProjection` is the workhorse — covers pan, zoom, and
"draw at world (3.4, 7.2)" placement. `createLinearPerspectiveProjection`
is the pseudo-3/4 projection the perspective-hex spec needs; defining
it as a built-in keeps that spec's complexity inside this one and gives
braille effects (lasers, splashes, atmospheric rings) a way to share
the same recession.

### Camera convenience

```ts
export interface CameraInput {
  position?: Point;     // world point at the screen center
  zoom?: number;        // uniform scale, default 1
  viewportSize: Size;   // cells
  projection?: (camera: Camera) => Projection; // default = orthographic
}

export class Camera {
  constructor(input: CameraInput);

  position: Point;
  zoom: number;
  readonly viewportSize: Size;

  /** Projection rebuilt from current camera state on demand. */
  readonly projection: Projection;

  /** Pan/zoom helpers. Mutate state, regenerate projection lazily. */
  panBy(delta: Point): void;
  setZoom(zoom: number): void;
  /** Rebuild with a custom projection factory (e.g. perspective). */
  setProjectionFactory(factory: (camera: Camera) => Projection): void;
}
```

The camera is optional sugar. Renderers and primitives only ever see a
`Projection`. A consumer that doesn't want camera state passes a
projection directly.

### Primitive integration

The integration is shallow on purpose: every place that currently takes a
**screen** point gains an optional `projection` that, when supplied,
treats the input as a **world** point. No existing call site changes
behavior.

```ts
// Surface — sprite anchor goes through projection.
surface.blit(sprite, { x, y }, options?: BlitOptions);
// New optional field on BlitOptions:
//   projection?: Projection; // when set, {x, y} is world space
//   anchor?: "topLeft" | "center"; // already exists conceptually; document here

// BrailleSurface — every dot-space call gains a world-space sibling.
braille.paintDot(x, y, fill);                              // unchanged, dot space
braille.paintWorldDot(world: Point, fill, projection);     // new
braille.fillCircle(centerDots, radiusDots, fill);          // unchanged
braille.fillWorldCircle(centerWorld, radiusWorld, fill, projection); // new
braille.drawWorldLine(fromWorld, toWorld, fill, projection);          // new

// Hex layout — projector helpers gain a world-space sibling.
projectHexCenter(layout, coord);                           // unchanged, screen space
// AxialCoord is already a "world" coord for hexes; no new function needed.
// `createPerspectiveHexGrid` (sibling spec) consumes a Projection internally.
```

Deciding factor for a `*World*` variant vs threading projection through
every call: keeping the screen-space primitives untouched preserves the
"this is a 2D cell renderer" mental model. Adding parallel
`*World*`-suffixed methods on `BrailleSurface` is cheap (each is a few
lines) and lets consumers mix freely — UI overlays in screen space,
world effects through the camera, in the same surface.

`Surface.blit` is the one exception where we extend `BlitOptions` rather
than add a `blitWorld`, because a `Sprite` already has a fixed cell size
— there's no resampling decision to make, only an anchor-point
decision, so threading a projection into the existing call is the
cleanest path.

### How perspective-hex composes

`createPerspectiveHexGrid` (sibling spec) becomes:

1. Internally constructs a `LinearPerspectiveProjection` from
   `nearScale`, `rankStep`, and the board's row count.
2. Uses that projection to choose per-rank integer scales (snap
   `projection.scaleAt(rankCenterWorld).y` to nearest integer scale).
3. Stacks per-rank strips, exposing `grid.projection` so consumers can
   place sprites or paint braille effects through the same projection
   the grid was rendered against.

The result: a unit's anchor goes through `grid.projection.project(...)`
and lands on the right rank's hex center automatically; a braille AOE
ring uses the same projection and shrinks correctly when cast on a rear
rank.

## Worked examples

### Smooth pan

```ts
const camera = new Camera({
  position: { x: 0, y: 0 },
  viewportSize: { width: 80, height: 30 }
});
camera.panBy({ x: 0.5, y: 0 }); // half-cell pan, smoothed via braille if needed

surface.blit(unitSprite, unitWorldPos, {
  projection: camera.projection,
  anchor: "center"
});
```

### World-space braille effect

```ts
const projection = camera.projection;
braille.fillWorldCircle(
  { x: targetTile.q, y: targetTile.r }, // world = axial hex
  /* radius in hex-units */ 0.8,
  { value: 0.6, style: { foreground: rgbColor(255, 200, 80) } },
  projection
);
```

The same braille call works whether `projection` is orthographic
(uniform circle), linear perspective (squashed ellipse on rear ranks),
or anything else.

### Perspective hex with shared projection

```ts
const grid = createPerspectiveHexGrid({
  board: { cols: 7, rows: 5 },
  nearScale: 4
});
// `grid.projection` is the linear perspective projection used internally.

for (const unit of units) {
  const world = { x: unit.position.q, y: unit.position.r };
  surface.blit(unit.sprite, world, {
    projection: grid.projection,
    anchor: "center"
  });
}
```

## Non-goals (v1)

- **Glyph resampling / sprite LOD.** `scaleAt` is exposed so future code
  can read it, but no primitive picks a different sprite size based on
  projection. Sprites stay their native cell size.
- **Z-axis / depth sort.** Projection input is `Point`, not `Point3`. A
  future revision could widen the input type without breaking existing
  consumers; not now.
- **Frustum culling.** Projections don't return "off-screen" indicators;
  consumers cull via existing surface clipping.
- **Animation curves on the camera.** `Camera.panBy` is a synchronous
  setter. Tweening lives in whatever animation primitives the roadmap's
  Phase 2 ships.
- **Multiple simultaneous projections per surface.** A surface composed
  of layers each rendered through a different projection is the
  consumer's job (compose at the scene level, not the primitive level).

## Migration

100% additive. No existing call signature changes. Every existing
consumer continues to work; new code opts in via `projection` /
`*World*` siblings. The `ORTHOGRAPHIC` constant gives a no-op default
that's always safe to thread through code that wants to be
projection-agnostic.

## Open questions

1. **Screen-space vs world-space defaults.** Should `Surface.blit` keep
   defaulting to screen space, or should there be a higher-level "scene"
   wrapper where the default is world space + you opt out into screen
   for HUD/overlays? Lean toward keeping the primitive screen-space
   default and letting a future scene helper flip it.
2. **`Projection.scaleAt` shape.** `{ x, y }` covers the cases we know
   about. A future need (axis-aligned shear, rotation) would want a 2x2
   matrix. Worth deciding now whether to ship the matrix shape from the
   start or keep `{ x, y }` and grow when forced.
3. **Camera as a class vs interface.** A class gives ergonomics
   (`panBy`, `setZoom`); an interface keeps things pure. The class is
   small and contained — fine — but if we ever want immutable cameras
   for time-travel debugging, an `updateCamera(camera, patch) -> Camera`
   helper is easy to add alongside.
4. **Naming.** `*World*` siblings on `BrailleSurface` add API noise.
   Alternative: a single `braille.withProjection(projection) ->
   BrailleSurfaceView` that shadows the dot-space methods with
   world-space ones. Less surface area, slightly more indirection.
   Prefer simple suffixes for v1.
5. **Where does `LinearPerspectiveProjection` live?** It's hex-flavoured
   in the way it's most useful, but the math is general. Probably
   `src/projection.ts` next to the camera, with hex specifically
   consuming it via `createPerspectiveHexGrid`.

## Related work

- [`perspective-hex.md`](./perspective-hex.md) — gets simpler with this
  spec landed; collapses to "build a `LinearPerspectiveProjection`,
  snap per-rank scales, stack strips, expose the projection."
- The braille `paintDot` rounding bug stays out of this spec; track in
  `perspective-hex.md`.
- A future "Tier C / sprite LOD" spec would extend `Surface.blit` so
  consumers can register pre-rendered LODs of a sprite and let
  `projection.scaleAt(anchor)` pick one. Compatible with everything
  here; no breaking changes.
