import { describe, expect, it } from 'vitest';
import {
  PLAYFIELD_CENTER,
  createInitialSensorState,
  resetCenter,
  stepCrosshairFromMotion,
  stepCrosshairFromOrientation,
} from './sensor';

describe('sensor core', () => {
  it('moves crosshair right when phone pans right (negative gammaRate/alphaRate in vertical posture) and up when tilting up (positive betaRate)', () => {
    const s0 = createInitialSensorState(4.0);
    // Upright portrait: gx = 0, gy = -9.8 (gravity pulls down -Y on device)
    const s1 = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: 20, // pitching phone up -> crosshair moves up (smaller Y)
      gammaRate: -30, // panning phone right -> crosshair moves right (larger X)
      gx: 0,
      gy: -9.8,
      gz: 0,
      dtSec: 0.016,
    });
    expect(s1.crosshair.x).toBeGreaterThan(PLAYFIELD_CENTER.x);
    expect(s1.crosshair.y).toBeLessThan(PLAYFIELD_CENTER.y);
  });

  it('compensates for roll angle using gravity vector and safely handles zero gravity vector', () => {
    const s0 = createInitialSensorState(4.0);
    // Phone tilted 90 deg counter-clockwise: gx = -9.8, gy = 0
    const tilted = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: 25,
      gammaRate: 0,
      gx: -9.8,
      gy: 0,
      gz: 0,
      dtSec: 0.02,
    });
    expect(Number.isFinite(tilted.crosshair.x)).toBe(true);
    expect(Number.isFinite(tilted.crosshair.y)).toBe(true);

    // Zero gravity fallback (gx=0, gy=0) must not produce NaN
    const zeroG = stepCrosshairFromMotion(s0, {
      alphaRate: 10,
      betaRate: 10,
      gammaRate: 10,
      gx: 0,
      gy: 0,
      gz: 0,
      dtSec: 0.02,
    });
    expect(Number.isFinite(zeroG.crosshair.x)).toBe(true);
    expect(Number.isFinite(zeroG.crosshair.y)).toBe(true);
  });

  it('clamps large dt spikes (e.g. tab resume dtSec = 2.0) so crosshair does not teleport off-screen', () => {
    const s0 = createInitialSensorState(4.0);
    const sSpike = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: 50,
      gammaRate: -50,
      gx: 0,
      gy: -9.8,
      gz: 0,
      dtSec: 2.0,
    });
    const sClamped = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: 50,
      gammaRate: -50,
      gx: 0,
      gy: -9.8,
      gz: 0,
      dtSec: 0.05,
    });
    expect(sSpike.crosshair).toEqual(sClamped.crosshair);
  });

  it('handles orientation fallback across the -180/180 degree wrap-around without jumping', () => {
    const s0 = stepCrosshairFromOrientation(createInitialSensorState(4.0), {
      alpha: 179,
      beta: 90,
      gamma: 0,
    });
    const s1 = stepCrosshairFromOrientation(s0, {
      alpha: -179, // +2 deg wrap
      beta: 91,
      gamma: 0,
    });
    expect(Math.abs(s1.crosshair.x - PLAYFIELD_CENTER.x)).toBeLessThan(20);
  });

  it('resets crosshair back to PLAYFIELD_CENTER', () => {
    const moved = { ...createInitialSensorState(), crosshair: { x: 200, y: 80 } };
    expect(resetCenter(moved).crosshair).toEqual(PLAYFIELD_CENTER);
  });
});
