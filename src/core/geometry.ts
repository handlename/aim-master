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

export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  // Stationary crosshair (a === b) produces lenSq = 0; guard against 0 / 0
  if (lenSq === 0) {
    return a;
  }

  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };
}

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const proj = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

export function segmentCircleIntersect(
  a: Point,
  b: Point,
  center: Point,
  radius: number
): boolean {
  return distancePointToSegment(center, a, b) <= radius;
}

// Compute unit vector pointing away from the impacting crosshair segment toward/through the target center
export function computeHitPushDirection(
  prevCrosshair: Point,
  nextCrosshair: Point,
  targetCenter: Point
): Point {
  const closest = closestPointOnSegment(targetCenter, prevCrosshair, nextCrosshair);
  let rx = targetCenter.x - closest.x;
  let ry = targetCenter.y - closest.y;
  let rLen = Math.hypot(rx, ry);

  // If the sweep line passed right through the exact target center, fall back to vector from prevCrosshair
  if (rLen < 1e-5) {
    rx = targetCenter.x - prevCrosshair.x;
    ry = targetCenter.y - prevCrosshair.y;
    rLen = Math.hypot(rx, ry);
  }

  const urx = rLen > 1e-5 ? rx / rLen : 0;
  const ury = rLen > 1e-5 ? ry / rLen : 0;

  const mdx = nextCrosshair.x - prevCrosshair.x;
  const mdy = nextCrosshair.y - prevCrosshair.y;
  const mLen = Math.hypot(mdx, mdy);
  const umx = mLen > 1e-5 ? mdx / mLen : 0;
  const umy = mLen > 1e-5 ? mdy / mLen : 0;

  const vx = urx * 0.7 + umx * 0.5;
  const vy = ury * 0.7 + umy * 0.5;
  const vLen = Math.hypot(vx, vy);

  if (vLen < 1e-5) {
    return { x: 0, y: -1 };
  }

  return {
    x: vx / vLen,
    y: vy / vLen,
  };
}
