import { describe, expect, it } from 'vitest';
import {
  clampPoint,
  computeHitPushDirection,
  distancePointToSegment,
  segmentCircleIntersect,
} from './geometry';

describe('geometry', () => {
  it('detects a fast sweep line segment grazing a circle edge', () => {
    // Segment from (10, 100) to (230, 100) passes y=100; circle at (120, 115) with radius 16 hits
    expect(segmentCircleIntersect({ x: 10, y: 100 }, { x: 230, y: 100 }, { x: 120, y: 115 }, 16)).toBe(true);
    expect(segmentCircleIntersect({ x: 10, y: 100 }, { x: 230, y: 100 }, { x: 120, y: 117 }, 16)).toBe(false);
  });

  it('handles zero-length segment (stationary crosshair) without NaN', () => {
    expect(distancePointToSegment({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 50 })).toBe(0);
    expect(segmentCircleIntersect({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 60, y: 50 }, 12)).toBe(true);
    expect(segmentCircleIntersect({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 70, y: 50 }, 12)).toBe(false);
  });

  it('does not hit when target is beyond segment endpoints along the same line', () => {
    expect(segmentCircleIntersect({ x: 10, y: 50 }, { x: 40, y: 50 }, { x: 80, y: 50 }, 15)).toBe(false);
  });

  it('clamps point within playfield rectangle', () => {
    const bounds = { minX: 8, minY: 44, maxX: 232, maxY: 348 };
    expect(clampPoint({ x: -20, y: 500 }, bounds)).toEqual({ x: 8, y: 348 });
  });

  it('computes normalized push direction away from impacting crosshair and handles degenerate center hit', () => {
    // Crosshair approaches target at (120, 152) from the left (80, 152) -> (108, 152)
    // Push direction should point right (+X)
    const dirRight = computeHitPushDirection(
      { x: 80, y: 152 },
      { x: 108, y: 152 },
      { x: 120, y: 152 }
    );
    expect(dirRight.x).toBeGreaterThan(0.9);
    expect(Math.abs(dirRight.y)).toBeLessThan(0.1);
    expect(Math.hypot(dirRight.x, dirRight.y)).toBeCloseTo(1, 5);

    // Crosshair sweeps horizontally across top edge of target at (120, 152): from (80, 140) to (160, 140)
    // Closest point is (120, 140), push radial vector is (0, +12) downward + sweep (+X) -> points down-right
    const dirGraze = computeHitPushDirection(
      { x: 80, y: 140 },
      { x: 160, y: 140 },
      { x: 120, y: 152 }
    );
    expect(dirGraze.x).toBeGreaterThan(0.2);
    expect(dirGraze.y).toBeGreaterThan(0.5);
    expect(Math.hypot(dirGraze.x, dirGraze.y)).toBeCloseTo(1, 5);

    // Degenerate stationary hit right on target center falls back to upward unit vector (0, -1) without NaN
    const dirDegenerate = computeHitPushDirection(
      { x: 120, y: 152 },
      { x: 120, y: 152 },
      { x: 120, y: 152 }
    );
    expect(dirDegenerate).toEqual({ x: 0, y: -1 });
  });
});
