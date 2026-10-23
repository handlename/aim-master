import { describe, expect, it } from 'vitest';
import { clampPoint, distancePointToSegment, segmentCircleIntersect } from './geometry';

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
});
