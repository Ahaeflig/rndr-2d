import {
  BRAILLE_DOT_COLUMNS,
  BRAILLE_DOT_ROWS,
  BrailleSurface,
  type BraillePaint
} from "./braille.js";
import type { DenseLightColor, DenseLightSurface } from "./glow.js";
import type { AxialCoord, HexBoardSize } from "./hex.js";
import type { Point, Size } from "./geometry.js";
import type { CellStyle } from "./style.js";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint3D {
  point: Point;
  depth: number;
  scale: number;
  visible: boolean;
}

export interface CameraBasis3D {
  right: Point3;
  up: Point3;
  forward: Point3;
}

export interface Projection3D {
  readonly viewportSize: Size;
  readonly screenCenter: Point;
  readonly basis: CameraBasis3D;
  project(point: Point3): ProjectedPoint3D;
  projectOrNull(point: Point3): ProjectedPoint3D | null;
}

export interface PerspectiveProjection3DInput {
  position: Point3;
  target: Point3;
  viewportSize: Size;
  /**
   * Camera-up hint. Defaults to +z, which matches world coordinates where
   * x/y form the ground plane and z is vertical.
   */
  up?: Point3;
  /** Vertical field of view in degrees. Default 50. */
  verticalFovDegrees?: number;
  near?: number;
  far?: number;
  screenCenter?: Point;
}

export interface OrthographicProjection3DInput {
  position: Point3;
  target: Point3;
  viewportSize: Size;
  up?: Point3;
  /** Screen cells per world unit. Default 1. */
  zoom?: number;
  near?: number;
  far?: number;
  screenCenter?: Point;
}

export type ProjectedBrailleBillboardAnchor = "center" | "bottomCenter" | "topLeft";

export interface ProjectedBrailleBillboardInput {
  projection: Projection3D;
  source: BrailleSurface;
  position: Point3;
  /** Physical billboard width in world units. */
  width: number;
  /** Physical billboard height in world units. */
  height: number;
  anchor?: ProjectedBrailleBillboardAnchor;
  /** Defaults to the projection camera's right axis. */
  right?: Point3;
  /** Defaults to the projection camera's up axis. */
  up?: Point3;
}

export interface ProjectedPlaneCircleInput {
  projection: Projection3D;
  center: Point3;
  radius: number;
  fill: BraillePaint | CellStyle | null;
  /** Plane-local x axis. Defaults to world +x. */
  axisX?: Point3;
  /** Plane-local y axis. Defaults to world +y. */
  axisY?: Point3;
  segments?: number;
}

export interface ProjectedLightPlaneRingInput {
  projection: Projection3D;
  center: Point3;
  radius: number;
  color: DenseLightColor;
  strength?: number;
  spread?: number;
  axisX?: Point3;
  axisY?: Point3;
  segments?: number;
}

export interface ProjectedHexPlaneLayout {
  /** Hex circumradius in world units. Default 1. */
  radius?: number;
  /** World-space center of the whole board. Default { x: 0, y: 0, z: 0 }. */
  center?: Point3;
  /**
   * Hex rotation in radians. Default 0deg gives flat top/bottom hexes,
   * matching odd-q boards that advance mostly along screen depth.
   */
  rotationRadians?: number;
}

export interface ProjectedHexGridInput extends ProjectedHexPlaneLayout {
  projection: Projection3D;
  board: HexBoardSize;
  fill?: BraillePaint | CellStyle | null | ((coord: AxialCoord) => BraillePaint | CellStyle | null | undefined);
  stroke?: BraillePaint | CellStyle | null | ((coord: AxialCoord) => BraillePaint | CellStyle | null | undefined);
}

const DEFAULT_UP: Point3 = { x: 0, y: 0, z: 1 };
const GROUND_X: Point3 = { x: 1, y: 0, z: 0 };
const GROUND_Y: Point3 = { x: 0, y: 1, z: 0 };
const DEFAULT_HEX_ROTATION_RADIANS = 0;

function assertFiniteNumber(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function assertPositive(name: string, value: number) {
  assertFiniteNumber(name, value);

  if (value <= 0) {
    throw new RangeError(`${name} must be positive.`);
  }
}

function assertViewport(size: Size) {
  assertPositive("Projection viewport width", size.width);
  assertPositive("Projection viewport height", size.height);
}

function assertBoardSize(board: HexBoardSize) {
  if (!Number.isInteger(board.cols) || board.cols <= 0) {
    throw new RangeError("Projected hex board cols must be a positive integer.");
  }

  if (!Number.isInteger(board.rows) || board.rows <= 0) {
    throw new RangeError("Projected hex board rows must be a positive integer.");
  }
}

function add3(a: Point3, b: Point3): Point3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract3(a: Point3, b: Point3): Point3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(vector: Point3, scale: number): Point3 {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale
  };
}

function dot3(a: Point3, b: Point3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function length3(vector: Point3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize3(name: string, vector: Point3): Point3 {
  const length = length3(vector);

  if (length <= 1e-9) {
    throw new RangeError(`${name} must not be a zero-length vector.`);
  }

  return scale3(vector, 1 / length);
}

function cameraBasis(position: Point3, target: Point3, upHint: Point3 = DEFAULT_UP): CameraBasis3D {
  const forward = normalize3("Camera forward", subtract3(target, position));
  let right = cross3(forward, upHint);

  if (length3(right) <= 1e-9) {
    right = cross3(forward, { x: 0, y: 1, z: 0 });
  }

  right = normalize3("Camera right", right);
  const up = normalize3("Camera up", cross3(right, forward));

  return { right, up, forward };
}

function defaultScreenCenter(viewportSize: Size): Point {
  return {
    x: viewportSize.width / 2,
    y: viewportSize.height / 2
  };
}

function viewCoordinates(point: Point3, position: Point3, basis: CameraBasis3D) {
  const relative = subtract3(point, position);

  return {
    x: dot3(relative, basis.right),
    y: dot3(relative, basis.up),
    depth: dot3(relative, basis.forward)
  };
}

function insideDepth(depth: number, near: number, far: number) {
  return depth >= near && depth <= far;
}

export function screenPointToBrailleDot(point: Point): Point {
  return {
    x: point.x * BRAILLE_DOT_COLUMNS,
    y: point.y * BRAILLE_DOT_ROWS
  };
}

export function createPerspectiveProjection3D(input: PerspectiveProjection3DInput): Projection3D {
  assertViewport(input.viewportSize);
  const near = input.near ?? 0.01;
  const far = input.far ?? Number.POSITIVE_INFINITY;
  const verticalFovDegrees = input.verticalFovDegrees ?? 50;
  assertPositive("Perspective near plane", near);
  assertPositive("Perspective vertical FOV", verticalFovDegrees);

  if (verticalFovDegrees >= 180) {
    throw new RangeError("Perspective vertical FOV must be less than 180 degrees.");
  }

  const basis = cameraBasis(input.position, input.target, input.up);
  const screenCenter = input.screenCenter ?? defaultScreenCenter(input.viewportSize);
  const verticalFovRadians = verticalFovDegrees * Math.PI / 180;
  const focalLength = (input.viewportSize.height / 2) / Math.tan(verticalFovRadians / 2);

  return {
    viewportSize: input.viewportSize,
    screenCenter,
    basis,
    project(point: Point3): ProjectedPoint3D {
      const view = viewCoordinates(point, input.position, basis);
      const visible = insideDepth(view.depth, near, far);
      const scale = focalLength / view.depth;

      return {
        point: {
          x: screenCenter.x + view.x * scale,
          y: screenCenter.y - view.y * scale
        },
        depth: view.depth,
        scale,
        visible
      };
    },
    projectOrNull(point: Point3) {
      const projected = this.project(point);
      return projected.visible ? projected : null;
    }
  };
}

export function createOrthographicProjection3D(input: OrthographicProjection3DInput): Projection3D {
  assertViewport(input.viewportSize);
  const near = input.near ?? Number.NEGATIVE_INFINITY;
  const far = input.far ?? Number.POSITIVE_INFINITY;
  const zoom = input.zoom ?? 1;
  assertPositive("Orthographic zoom", zoom);
  const basis = cameraBasis(input.position, input.target, input.up);
  const screenCenter = input.screenCenter ?? defaultScreenCenter(input.viewportSize);

  return {
    viewportSize: input.viewportSize,
    screenCenter,
    basis,
    project(point: Point3): ProjectedPoint3D {
      const view = viewCoordinates(point, input.position, basis);

      return {
        point: {
          x: screenCenter.x + view.x * zoom,
          y: screenCenter.y - view.y * zoom
        },
        depth: view.depth,
        scale: zoom,
        visible: insideDepth(view.depth, near, far)
      };
    },
    projectOrNull(point: Point3) {
      const projected = this.project(point);
      return projected.visible ? projected : null;
    }
  };
}

export function projectPointToBrailleDot(projection: Projection3D, point: Point3): Point | null {
  const projected = projection.projectOrNull(point);
  return projected ? screenPointToBrailleDot(projected.point) : null;
}

export function paintProjectedDot(
  surface: BrailleSurface,
  projection: Projection3D,
  point: Point3,
  fill: BraillePaint | CellStyle | null
) {
  const dot = projectPointToBrailleDot(projection, point);

  if (!dot) {
    return;
  }

  surface.paintDot(dot.x, dot.y, fill);
}

function projectedDotPolygon(projection: Projection3D, points: readonly Point3[]) {
  const projected: Point[] = [];

  for (const point of points) {
    const dot = projectPointToBrailleDot(projection, point);

    if (!dot) {
      return null;
    }

    projected.push(dot);
  }

  return projected;
}

export function drawProjectedLine(
  surface: BrailleSurface,
  projection: Projection3D,
  from: Point3,
  to: Point3,
  fill: BraillePaint | CellStyle | null
) {
  const fromDot = projectPointToBrailleDot(projection, from);
  const toDot = projectPointToBrailleDot(projection, to);

  if (!fromDot || !toDot) {
    return;
  }

  surface.drawDotLine(fromDot, toDot, fill);
}

export function strokeProjectedPolygon(
  surface: BrailleSurface,
  projection: Projection3D,
  points: readonly Point3[],
  fill: BraillePaint | CellStyle | null
) {
  const projected = projectedDotPolygon(projection, points);

  if (!projected) {
    return;
  }

  surface.strokePolygon(projected, fill);
}

export function fillProjectedPolygon(
  surface: BrailleSurface,
  projection: Projection3D,
  points: readonly Point3[],
  fill: BraillePaint | CellStyle | null
) {
  const projected = projectedDotPolygon(projection, points);

  if (!projected) {
    return;
  }

  surface.fillPolygon(projected, fill);
}

function planeCirclePoints(input: {
  center: Point3;
  radius: number;
  axisX?: Point3;
  axisY?: Point3;
  segments?: number;
}) {
  assertPositive("Projected plane circle radius", input.radius);
  const segments = input.segments ?? 48;

  if (!Number.isInteger(segments) || segments < 8) {
    throw new RangeError("Projected plane circle segments must be an integer greater than or equal to 8.");
  }

  const axisX = normalize3("Projected plane circle x axis", input.axisX ?? GROUND_X);
  const axisY = normalize3("Projected plane circle y axis", input.axisY ?? GROUND_Y);
  const points: Point3[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(add3(
      add3(input.center, scale3(axisX, Math.cos(angle) * input.radius)),
      scale3(axisY, Math.sin(angle) * input.radius)
    ));
  }

  return points;
}

function hexPlaneRawCenter(coord: AxialCoord, radius: number) {
  const hexHeight = Math.sqrt(3) * radius;

  return {
    x: coord.q * 1.5 * radius,
    y: (coord.r + (Math.abs(coord.q) % 2) * 0.5) * hexHeight
  };
}

function hexPlaneBoardCenter(board: HexBoardSize, radius: number) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let q = 0; q < board.cols; q += 1) {
    for (let r = 0; r < board.rows; r += 1) {
      const center = hexPlaneRawCenter({ q, r }, radius);
      minX = Math.min(minX, center.x);
      minY = Math.min(minY, center.y);
      maxX = Math.max(maxX, center.x);
      maxY = Math.max(maxY, center.y);
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2
  };
}

function projectedHexPlaneRadius(layout: ProjectedHexPlaneLayout) {
  const radius = layout.radius ?? 1;
  assertPositive("Projected hex radius", radius);
  return radius;
}

function projectedHexPlaneCenter(layout: ProjectedHexPlaneLayout) {
  return layout.center ?? { x: 0, y: 0, z: 0 };
}

export function projectedHexPlaneCenterPoint(
  board: HexBoardSize,
  coord: AxialCoord,
  layout: ProjectedHexPlaneLayout = {}
): Point3 {
  assertBoardSize(board);
  const radius = projectedHexPlaneRadius(layout);
  const raw = hexPlaneRawCenter(coord, radius);
  const boardCenter = hexPlaneBoardCenter(board, radius);
  const center = projectedHexPlaneCenter(layout);

  return {
    x: center.x + raw.x - boardCenter.x,
    y: center.y + raw.y - boardCenter.y,
    z: center.z
  };
}

export function projectedHexPlaneCorners(
  board: HexBoardSize,
  coord: AxialCoord,
  layout: ProjectedHexPlaneLayout = {}
): Point3[] {
  const center = projectedHexPlaneCenterPoint(board, coord, layout);
  const radius = projectedHexPlaneRadius(layout);
  const rotation = layout.rotationRadians ?? DEFAULT_HEX_ROTATION_RADIANS;
  const points: Point3[] = [];

  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / 6;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      z: center.z
    });
  }

  return points;
}

function resolveProjectedHexPaint(
  paint: ProjectedHexGridInput["fill"] | ProjectedHexGridInput["stroke"],
  coord: AxialCoord
) {
  return typeof paint === "function" ? paint(coord) ?? null : paint ?? null;
}

export function drawProjectedHexGrid(surface: BrailleSurface, input: ProjectedHexGridInput) {
  assertBoardSize(input.board);

  const coords: AxialCoord[] = [];
  for (let q = 0; q < input.board.cols; q += 1) {
    for (let r = 0; r < input.board.rows; r += 1) {
      coords.push({ q, r });
    }
  }

  for (const coord of coords) {
    const fill = resolveProjectedHexPaint(input.fill, coord);

    if (!fill) {
      continue;
    }

    fillProjectedPolygon(
      surface,
      input.projection,
      projectedHexPlaneCorners(input.board, coord, input),
      fill
    );
  }

  for (const coord of coords) {
    const stroke = resolveProjectedHexPaint(input.stroke, coord);

    if (!stroke) {
      continue;
    }

    strokeProjectedPolygon(
      surface,
      input.projection,
      projectedHexPlaneCorners(input.board, coord, input),
      stroke
    );
  }
}

export function strokeProjectedPlaneCircle(surface: BrailleSurface, input: ProjectedPlaneCircleInput) {
  strokeProjectedPolygon(
    surface,
    input.projection,
    planeCirclePoints(input),
    input.fill
  );
}

export function fillProjectedPlaneCircle(surface: BrailleSurface, input: ProjectedPlaneCircleInput) {
  fillProjectedPolygon(
    surface,
    input.projection,
    planeCirclePoints(input),
    input.fill
  );
}

function billboardAnchor(anchor: ProjectedBrailleBillboardAnchor) {
  switch (anchor) {
    case "topLeft":
      return { x: 0, y: 0 };
    case "bottomCenter":
      return { x: 0.5, y: 1 };
    case "center":
      return { x: 0.5, y: 0.5 };
  }
}

function billboardPoint(input: {
  position: Point3;
  right: Point3;
  up: Point3;
  width: number;
  height: number;
  anchor: Point;
  u: number;
  v: number;
}) {
  return add3(
    add3(
      input.position,
      scale3(input.right, (input.u - input.anchor.x) * input.width)
    ),
    scale3(input.up, (input.anchor.y - input.v) * input.height)
  );
}

export function blitProjectedBrailleBillboard(
  target: BrailleSurface,
  input: ProjectedBrailleBillboardInput
) {
  assertPositive("Projected billboard width", input.width);
  assertPositive("Projected billboard height", input.height);

  const right = normalize3("Projected billboard right axis", input.right ?? input.projection.basis.right);
  const up = normalize3("Projected billboard up axis", input.up ?? input.projection.basis.up);
  const anchor = billboardAnchor(input.anchor ?? "center");

  for (let y = 0; y < input.source.dotHeight; y += 1) {
    for (let x = 0; x < input.source.dotWidth; x += 1) {
      const dot = input.source.dotAt(x, y);

      if (!dot) {
        continue;
      }

      const left = x / input.source.dotWidth;
      const rightEdge = (x + 1) / input.source.dotWidth;
      const top = y / input.source.dotHeight;
      const bottom = (y + 1) / input.source.dotHeight;
      const corners = [
        billboardPoint({ ...input, right, up, anchor, u: left, v: top }),
        billboardPoint({ ...input, right, up, anchor, u: rightEdge, v: top }),
        billboardPoint({ ...input, right, up, anchor, u: rightEdge, v: bottom }),
        billboardPoint({ ...input, right, up, anchor, u: left, v: bottom })
      ];
      const projected = projectedDotPolygon(input.projection, corners);

      if (projected) {
        target.fillPolygon(projected, dot);
        continue;
      }

      const center = billboardPoint({
        ...input,
        right,
        up,
        anchor,
        u: (left + rightEdge) / 2,
        v: (top + bottom) / 2
      });
      paintProjectedDot(target, input.projection, center, dot);
    }
  }
}

export function addProjectedLightDot(
  surface: DenseLightSurface,
  projection: Projection3D,
  point: Point3,
  color: DenseLightColor,
  energy = 1
) {
  const dot = projectPointToBrailleDot(projection, point);

  if (!dot) {
    return;
  }

  surface.addDot(dot.x, dot.y, color, energy);
}

export function addProjectedLightLine(
  surface: DenseLightSurface,
  projection: Projection3D,
  from: Point3,
  to: Point3,
  color: DenseLightColor,
  energy = 1,
  radius = 0.8
) {
  const fromDot = projectPointToBrailleDot(projection, from);
  const toDot = projectPointToBrailleDot(projection, to);

  if (!fromDot || !toDot) {
    return;
  }

  surface.addLine(fromDot, toDot, color, energy, radius);
}

export function addProjectedLightPlaneRing(surface: DenseLightSurface, input: ProjectedLightPlaneRingInput) {
  const points = planeCirclePoints(input);
  const spread = input.spread ?? 0.8;
  const strength = input.strength ?? 1;

  for (let index = 0; index < points.length; index += 1) {
    const from = points[index] ?? points[0]!;
    const to = points[(index + 1) % points.length] ?? points[0]!;
    addProjectedLightLine(surface, input.projection, from, to, input.color, strength, spread);
  }
}
