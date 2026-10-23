export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export function clampPoint(p: Point, bounds: Rect): Point {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, p.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, p.y)),
  };
}

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  // Stationary crosshair (a === b) produces lenSq = 0; guard against 0 / 0
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function segmentCircleIntersect(
  a: Point,
  b: Point,
  center: Point,
  radius: number
): boolean {
  return distancePointToSegment(center, a, b) <= radius;
}
