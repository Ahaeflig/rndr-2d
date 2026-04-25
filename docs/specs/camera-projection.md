# Spec: 3D Camera Projection

Implemented first slice for shared world-to-screen projection in `rndr-2d`.

The goal is a Pokemon-like tilted world view that still composes through the
existing terminal cell model: terrain, glows, targeting shapes, and billboarded
braille sprites can live in 3D-ish world space, project into continuous screen
cell coordinates, then rasterize into braille dots or normal cells.

## Scope

This is a geometry and rasterization helper layer, not a full 3D engine.

In scope:

- look-at perspective projection from `Point3` world coordinates to screen
  cell coordinates
- look-at orthographic projection for fixed tilted views
- projected braille points, lines, polygons, and plane circles
- projected dense-light dots, lines, and plane rings
- projected braille billboards, where each source braille dot is rasterized as
  a projected quad

Out of scope:

- z-buffering and automatic occlusion
- terminal runtime camera ownership
- sprite glyph resampling
- rich scene graph behavior
- clipping polygons against the near plane

Consumers still decide draw order. The projection returns depth so consumers can
sort world items before drawing when they need painter-style layering.

## Coordinate Model

World space uses this convention:

- `x`: right
- `y`: forward on the ground plane
- `z`: up

Screen space is the existing `rndr-2d` cell coordinate system:

- origin at top-left
- `+x` right
- `+y` down
- one unit is one terminal cell

Braille projection converts screen cells into dot coordinates by multiplying by
the braille cell density:

```ts
dot.x = screen.x * BRAILLE_DOT_COLUMNS;
dot.y = screen.y * BRAILLE_DOT_ROWS;
```

`BrailleSurface.paintDot` rounds fractional dot coordinates at the paint
boundary. Projection math stays continuous until that final raster step.

## Public API

```ts
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint3D {
  point: Point;   // continuous screen cell point
  depth: number;  // distance along camera forward axis
  scale: number;  // screen cells per world unit at this depth
  visible: boolean;
}

export interface Projection3D {
  readonly viewportSize: Size;
  readonly screenCenter: Point;
  readonly basis: CameraBasis3D;
  project(point: Point3): ProjectedPoint3D;
  projectOrNull(point: Point3): ProjectedPoint3D | null;
}
```

Projection factories:

```ts
createPerspectiveProjection3D({
  position: { x: 0, y: -8, z: 6 },
  target: { x: 0, y: 6, z: 0 },
  viewportSize: { width: 80, height: 30 },
  verticalFovDegrees: 55
});

createOrthographicProjection3D({
  position: { x: 0, y: -8, z: 6 },
  target: { x: 0, y: 6, z: 0 },
  viewportSize: { width: 80, height: 30 },
  zoom: 2
});
```

Braille helpers:

```ts
paintProjectedDot(surface, projection, worldPoint, fill);
drawProjectedLine(surface, projection, from, to, fill);
strokeProjectedPolygon(surface, projection, points, fill);
fillProjectedPolygon(surface, projection, points, fill);
strokeProjectedPlaneCircle(surface, input);
fillProjectedPlaneCircle(surface, input);
blitProjectedBrailleBillboard(target, input);
```

Dense-light helpers:

```ts
addProjectedLightDot(surface, projection, worldPoint, color, energy);
addProjectedLightLine(surface, projection, from, to, color, energy, radius);
addProjectedLightPlaneRing(surface, input);
```

## Pokemon-Like View

A tilted view can be perspective or orthographic. The Pokemon-style version is
often closer to orthographic, but the same world primitives work with either
projection.

```ts
const projection = createPerspectiveProjection3D({
  position: { x: 0, y: -10, z: 7 },
  target: { x: 0, y: 8, z: 0 },
  viewportSize: { width: 64, height: 24 },
  verticalFovDegrees: 50
});

const terrain = new BrailleSurface(64, 24, {
  activationThreshold: 0.2
});

fillProjectedPlaneCircle(terrain, {
  projection,
  center: { x: 0, y: 8, z: 0 },
  radius: 2,
  fill: { value: 1, style: { foreground: rgbColor(64, 180, 96) } },
  segments: 32
});
```

## Braille Billboards

Braille billboards are for upright world objects: units, trees, signs, hit
sparks, or other authored dense sprites.

Each source dot becomes a small world-space quad aligned to the camera's right
and up axes by default. That quad is projected and filled into the target
braille surface. Close billboards cover more dots; far billboards cover fewer
dots.

```ts
const creature = new BrailleSurface(3, 4);
// author creature dots...

blitProjectedBrailleBillboard(terrain, {
  projection,
  source: creature,
  position: { x: 1, y: 9, z: 0 },
  width: 1.2,
  height: 1.8,
  anchor: "bottomCenter"
});
```

This gives perspective-correct scale and placement without asking the core
`Surface` or `Sprite` APIs to understand cameras.

## Hexes

The projection layer does not need a special perspective-hex primitive.

If hex terrain needs perspective, model each hex as continuous world geometry:

```text
axial coord -> ground-plane center/corners -> projection -> braille polygon
```

That keeps perspective, glows, outlines, and targeting areas on the same
projection path. Text labels and classic cell sprites can still be layered as
normal screen-space or depth-sorted overlay content.

## Invariants

- Projection helpers are pure apart from drawing into the supplied raster.
- Identical camera and world inputs produce identical screen/dot output.
- Projection does not write ANSI or inspect terminal state.
- Rounding happens at the raster boundary, not inside the camera math.
- Dense and braille projected helpers remain ordinary `RasterSource` producers
  once compiled.
