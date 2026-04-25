import { describe, expect, it } from "vitest";

import {
  BrailleSurface,
  DenseLightSurface,
  ansiColor,
  blitProjectedBrailleBillboard,
  createOrthographicProjection3D,
  createPerspectiveProjection3D,
  drawProjectedHexGrid,
  fillProjectedPlaneCircle,
  projectedHexPlaneCenterPoint,
  projectedHexPlaneCorners,
  projectPointToBrailleDot,
  rgbColor,
  screenPointToBrailleDot,
  strokeProjectedPolygon,
  addProjectedLightPlaneRing
} from "../src/index.js";

function countDots(surface: BrailleSurface) {
  let count = 0;

  for (let y = 0; y < surface.dotHeight; y += 1) {
    for (let x = 0; x < surface.dotWidth; x += 1) {
      if (surface.dotAt(x, y)) {
        count += 1;
      }
    }
  }

  return count;
}

describe("3D projection primitives", () => {
  it("projects world points through a look-at perspective camera", () => {
    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 10, z: 0 },
      viewportSize: { width: 100, height: 50 },
      verticalFovDegrees: 90
    });

    const center = projection.project({ x: 0, y: 10, z: 0 });
    const right = projection.project({ x: 10, y: 10, z: 0 });
    const high = projection.project({ x: 0, y: 10, z: 10 });
    const far = projection.project({ x: 0, y: 20, z: 0 });

    expect(center.visible).toBe(true);
    expect(center.point.x).toBeCloseTo(50);
    expect(center.point.y).toBeCloseTo(25);
    expect(center.depth).toBeCloseTo(10);
    expect(center.scale).toBeCloseTo(2.5);
    expect(right.point.x).toBeCloseTo(75);
    expect(high.point.y).toBeCloseTo(0);
    expect(far.scale).toBeLessThan(center.scale);
  });

  it("supports orthographic 3D projection for fixed tilted views", () => {
    const projection = createOrthographicProjection3D({
      position: { x: 0, y: -10, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      viewportSize: { width: 20, height: 10 },
      zoom: 2
    });

    const center = projection.project({ x: 0, y: 0, z: 0 });
    const right = projection.project({ x: 2, y: 0, z: 0 });

    expect(center.visible).toBe(true);
    expect(center.point).toEqual({ x: 10, y: 5 });
    expect(right.point.x).toBeCloseTo(14);
    expect(right.point.y).toBeCloseTo(5);
    expect(center.scale).toBe(2);
  });

  it("maps projected screen cells into braille dot coordinates", () => {
    expect(screenPointToBrailleDot({ x: 3.25, y: 2.5 })).toEqual({
      x: 6.5,
      y: 10
    });

    const projection = createOrthographicProjection3D({
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      viewportSize: { width: 10, height: 4 },
      zoom: 1
    });

    expect(projectPointToBrailleDot(projection, { x: 1, y: 1, z: 0 })).toEqual({
      x: 12,
      y: 4
    });
  });

  it("rounds fractional braille dot writes at the paint boundary", () => {
    const surface = new BrailleSurface(1, 1);

    surface.paintDot(0.49, 0.51, {
      value: 1,
      style: { foreground: ansiColor(81) }
    });

    expect(surface.dotAt(0, 1)?.style?.foreground).toEqual(ansiColor(81));
  });

  it("projects plane circles as braille polygons", () => {
    const surface = new BrailleSurface(20, 8, {
      activationThreshold: 0.2
    });
    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: -8, z: 6 },
      target: { x: 0, y: 6, z: 0 },
      viewportSize: { width: surface.width, height: surface.height },
      verticalFovDegrees: 55
    });

    fillProjectedPlaneCircle(surface, {
      projection,
      center: { x: 0, y: 7, z: 0 },
      radius: 2,
      fill: {
        value: 1,
        style: { foreground: ansiColor(34) }
      },
      segments: 24
    });

    expect(countDots(surface)).toBeGreaterThan(0);
    expect(surface.toSurface().toLines().some((line) => line.trim().length > 0)).toBe(true);
  });

  it("renders nearer projected braille billboards larger than farther ones", () => {
    const source = new BrailleSurface(1, 1);
    source.paintCell(0, 0, {
      value: 1,
      style: { foreground: rgbColor(255, 200, 80) }
    });

    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: 0, z: 0 },
      target: { x: 0, y: 10, z: 0 },
      viewportSize: { width: 30, height: 18 },
      verticalFovDegrees: 70
    });
    const near = new BrailleSurface(30, 18);
    const far = new BrailleSurface(30, 18);

    blitProjectedBrailleBillboard(near, {
      projection,
      source,
      position: { x: 0, y: 8, z: 0 },
      width: 2,
      height: 3
    });
    blitProjectedBrailleBillboard(far, {
      projection,
      source,
      position: { x: 0, y: 18, z: 0 },
      width: 2,
      height: 3
    });

    expect(countDots(near)).toBeGreaterThan(countDots(far));
    expect(countDots(far)).toBeGreaterThan(0);
  });

  it("projects glow rings through the same camera", () => {
    const light = new DenseLightSurface(20, 8, {
      dither: false,
      minEnergy: 0,
      activationThreshold: 0.2
    });
    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: -8, z: 6 },
      target: { x: 0, y: 6, z: 0 },
      viewportSize: { width: light.width, height: light.height },
      verticalFovDegrees: 55
    });

    addProjectedLightPlaneRing(light, {
      projection,
      center: { x: 0, y: 7, z: 0 },
      radius: 2,
      color: { r: 80, g: 200, b: 255 },
      segments: 24,
      spread: 1.2,
      strength: 2
    });

    expect(light.toBrailleSurface().toSurface().toLines().some((line) => line.trim().length > 0)).toBe(true);
  });

  it("strokes projected world polygons", () => {
    const surface = new BrailleSurface(16, 8);
    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: -8, z: 4 },
      target: { x: 0, y: 8, z: 0 },
      viewportSize: { width: surface.width, height: surface.height }
    });

    strokeProjectedPolygon(
      surface,
      projection,
      [
        { x: -2, y: 7, z: 0 },
        { x: 2, y: 7, z: 0 },
        { x: 2, y: 10, z: 0 },
        { x: -2, y: 10, z: 0 }
      ],
      { value: 1, style: { foreground: ansiColor(45) } }
    );

    expect(countDots(surface)).toBeGreaterThan(0);
  });

  it("renders projected braille hex grids on the camera ground plane", () => {
    const surface = new BrailleSurface(32, 16, {
      activationThreshold: 0.2
    });
    const projection = createPerspectiveProjection3D({
      position: { x: 0, y: 10, z: 8 },
      target: { x: 0, y: 0, z: 0 },
      viewportSize: { width: surface.width, height: surface.height },
      verticalFovDegrees: 42,
      screenCenter: { x: surface.width / 2, y: surface.height * 0.58 }
    });

    drawProjectedHexGrid(surface, {
      projection,
      board: { cols: 3, rows: 3 },
      radius: 1,
      fill: (coord) => ({
        value: coord.r === 2 ? 0.65 : 0.35,
        style: { foreground: coord.r === 2 ? ansiColor(45) : ansiColor(242) }
      }),
      stroke: { value: 1, style: { foreground: rgbColor(180, 190, 210) } }
    });

    const near = projection.project(projectedHexPlaneCenterPoint({ cols: 3, rows: 3 }, { q: 1, r: 2 }));
    const far = projection.project(projectedHexPlaneCenterPoint({ cols: 3, rows: 3 }, { q: 1, r: 0 }));

    expect(countDots(surface)).toBeGreaterThan(20);
    expect(surface.toSurface().toLines().some((line) => line.trim().length > 0)).toBe(true);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(true);
    expect(near.point.y).toBeGreaterThan(far.point.y);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it("uses flat-top corners for projected odd-q hex planes by default", () => {
    const center = projectedHexPlaneCenterPoint({ cols: 1, rows: 1 }, { q: 0, r: 0 });
    const corners = projectedHexPlaneCorners({ cols: 1, rows: 1 }, { q: 0, r: 0 });

    expect(corners).toHaveLength(6);
    expect(corners[0]?.x).toBeCloseTo(center.x + 1);
    expect(corners[0]?.y).toBeCloseTo(center.y);
    expect(corners[1]?.y).toBeCloseTo(corners[2]?.y ?? 0);
    expect(corners[4]?.y).toBeCloseTo(corners[5]?.y ?? 0);
  });
});
