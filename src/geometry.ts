export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}

function pointOnSegment(point: Point, start: Point, end: Point, epsilon = 1e-9) {
  const cross =
    (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);

  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot =
    (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);

  if (dot < -epsilon) {
    return false;
  }

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) + (end.y - start.y) * (end.y - start.y);

  return dot <= squaredLength + epsilon;
}

export function pointInPolygon(point: Point, polygon: readonly Point[]) {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index] ?? polygon[0]!;
    const prior = polygon[previous] ?? polygon[0]!;

    if (pointOnSegment(point, prior, current)) {
      return true;
    }

    const spansY = (current.y > point.y) !== (prior.y > point.y);

    if (!spansY) {
      continue;
    }

    const intersectionX =
      ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x;

    if (point.x < intersectionX) {
      inside = !inside;
    }
  }

  return inside;
}

export function plotLinePoints(from: Point, to: Point): Point[] {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);
  const points: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });

    if (x0 === x1 && y0 === y1) {
      return points;
    }

    const doubledError = error * 2;

    if (doubledError >= dy) {
      error += dy;
      x0 += sx;
    }

    if (doubledError <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}
