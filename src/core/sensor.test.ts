import { describe, expect, it } from 'vitest';
import {
  PLAYFIELD_CENTER,
  createInitialSensorState,
  requestSensorPermissions,
  resetCenter,
  shouldApplyPointerFallback,
  stepCrosshairFromMotion,
  stepCrosshairFromOrientation,
  updateSensorOptions,
} from './sensor';

describe('sensor core', () => {
  it('moves crosshair right when phone pans right (negative betaRate around Y-axis) and up when tilting up (positive alphaRate around X-axis)', () => {
    const s0 = createInitialSensorState(4.0);
    // Upright portrait: gx = 0, gy = -9.8 (gravity pulls down -Y on device)
    // In WebKit DeviceMotionEvent.rotationRate:
    // alpha = X-axis (pitch up/down), beta = Y-axis (yaw/pan left/right when vertical), gamma = Z-axis
    const s1 = stepCrosshairFromMotion(s0, {
      alphaRate: 20, // pitching phone up around X-axis -> crosshair moves up (smaller Y)
      betaRate: -30, // panning phone right around Y-axis -> crosshair moves right (larger X)
      gammaRate: 0,
      gx: 0,
      gy: -9.8,
      gz: 0,
      dtSec: 0.016,
    });
    expect(s1.crosshair.x).toBeGreaterThan(PLAYFIELD_CENTER.x);
    expect(s1.crosshair.y).toBeLessThan(PLAYFIELD_CENTER.y);
  });

  it('compensates for roll angle and works identically when phone is held horizontally in Landscape-Left or Landscape-Right', () => {
    const s0 = createInitialSensorState(6.0);
    // Landscape-Left (rotated 90 deg CCW: gx = -9.8, gy = 0, gz = 0)
    // Pure horizontal pan right in real world is negative alphaRate (betaRate = 0) -> only X should increase!
    const landscapeLeftPan = stepCrosshairFromMotion(s0, {
      alphaRate: -25,
      betaRate: 0,
      gammaRate: 0,
      gx: -9.8,
      gy: 0,
      gz: 0,
      dtSec: 0.02,
    });
    expect(landscapeLeftPan.crosshair.x - PLAYFIELD_CENTER.x).toBeCloseTo(3.0, 2);
    expect(landscapeLeftPan.crosshair.y).toBeCloseTo(PLAYFIELD_CENTER.y, 2);

    // Pure vertical tilt up in Landscape-Left is negative betaRate (alphaRate = 0) -> only Y should decrease!
    const landscapeLeftTilt = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: -25,
      gammaRate: 0,
      gx: -9.8,
      gy: 0,
      gz: 0,
      dtSec: 0.02,
    });
    expect(landscapeLeftTilt.crosshair.x).toBeCloseTo(PLAYFIELD_CENTER.x, 2);
    expect(PLAYFIELD_CENTER.y - landscapeLeftTilt.crosshair.y).toBeCloseTo(3.0, 2);

    // Landscape-Right (rotated 90 deg CW: gx = +9.8, gy = 0, gz = 0)
    // Pure horizontal pan right is positive alphaRate; pure vertical tilt up is positive betaRate
    const landscapeRight = stepCrosshairFromMotion(s0, {
      alphaRate: 25,
      betaRate: 25,
      gammaRate: 0,
      gx: 9.8,
      gy: 0,
      gz: 0,
      dtSec: 0.02,
    });
    expect(landscapeRight.crosshair.x - PLAYFIELD_CENTER.x).toBeCloseTo(3.0, 2);
    expect(PLAYFIELD_CENTER.y - landscapeRight.crosshair.y).toBeCloseTo(3.0, 2);

    // Zero gravity fallback (gx=0, gy=0, gz=0) must not produce NaN
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

  it('invokes requestPermission with bound receiver context (this === constructor) and avoids second prompt when motion permission exists', async () => {
    let orientCalled = false;
    const fakeMotionTarget = {
      expectedThis: true,
      async requestPermission(this: { expectedThis?: boolean }) {
        if (!this || !this.expectedThis) {
          throw new TypeError('Illegal invocation');
        }
        return 'granted' as const;
      },
    };
    const fakeOrientTarget = {
      expectedThis: true,
      async requestPermission(this: { expectedThis?: boolean }) {
        if (!this || !this.expectedThis) {
          throw new TypeError('Illegal invocation');
        }
        orientCalled = true;
        return 'granted' as const;
      },
    };

    const granted = await requestSensorPermissions(fakeMotionTarget, fakeOrientTarget);
    expect(granted).toBe(true);
    expect(orientCalled).toBe(false);
  });

  it('maintains full vertical and horizontal responsiveness when the phone is tilted upward (pitched into Z with slight X roll)', () => {
    const s0 = createInitialSensorState(6.0);
    // Upright reference movement
    const uprightVert = stepCrosshairFromMotion(s0, {
      alphaRate: 25,
      betaRate: 0,
      gammaRate: 0,
      gx: 0.8,
      gy: -9.7,
      gz: 0,
      dtSec: 0.02,
    });

    // Phone tilted 55 deg upward (gy = -5.6, gz = 8.0) with the same slight hand roll gx = 0.8
    // Vertical movement must not shrink, and actually gains tangent ray projection boost
    const pitchedVert = stepCrosshairFromMotion(s0, {
      alphaRate: 25,
      betaRate: 0,
      gammaRate: 0,
      gx: 0.8,
      gy: -5.6,
      gz: 8.0,
      dtSec: 0.02,
    });
    const uprightDy = PLAYFIELD_CENTER.y - uprightVert.crosshair.y;
    const pitchedDy = PLAYFIELD_CENTER.y - pitchedVert.crosshair.y;
    expect(pitchedDy).toBeGreaterThanOrEqual(uprightDy);

    // Horizontal pan while tilted forward 45 deg (gy = -6.9, gz = 6.9):
    // World yaw right has betaRate < 0 and gammaRate > 0; must not cancel out!
    const pitchedHoriz = stepCrosshairFromMotion(s0, {
      alphaRate: 0,
      betaRate: -21.2,
      gammaRate: 21.2,
      gx: 0,
      gy: -6.9,
      gz: 6.9,
      dtSec: 0.02,
    });
    expect(pitchedHoriz.crosshair.x - PLAYFIELD_CENTER.x).toBeGreaterThan(3.0);
  });

  it('ignores touch pointer fallback when motion sensors are active to prevent accidental palm jumps', () => {
    expect(shouldApplyPointerFallback(true, 'touch', 1)).toBe(false);
    expect(shouldApplyPointerFallback(false, 'touch', 1)).toBe(true);
    expect(shouldApplyPointerFallback(false, 'mouse', 0)).toBe(true);
  });

  it('adjusts sensitivity and inverts X and Y axes when configured via updateSensorOptions', () => {
    const base = createInitialSensorState(6.0);
    const sample = {
      alphaRate: 20, // normally moves up (y < center)
      betaRate: -20, // normally moves right (x > center)
      gammaRate: 0,
      gx: 0,
      gy: -9.8,
      gz: 0,
      dtSec: 0.02,
    };

    const normalMoved = stepCrosshairFromMotion(base, sample);
    expect(normalMoved.crosshair.x).toBeGreaterThan(PLAYFIELD_CENTER.x);
    expect(normalMoved.crosshair.y).toBeLessThan(PLAYFIELD_CENTER.y);

    // Double sensitivity and invert both X and Y
    const customState = updateSensorOptions(base, {
      sensitivity: 12.0,
      invertX: true,
      invertY: true,
    });
    const invertedMoved = stepCrosshairFromMotion(customState, sample);
    expect(invertedMoved.crosshair.x).toBeLessThan(PLAYFIELD_CENTER.x);
    expect(invertedMoved.crosshair.y).toBeGreaterThan(PLAYFIELD_CENTER.y);

    const normalDx = Math.abs(normalMoved.crosshair.x - PLAYFIELD_CENTER.x);
    const invertedDx = Math.abs(invertedMoved.crosshair.x - PLAYFIELD_CENTER.x);
    expect(invertedDx).toBeCloseTo(normalDx * 2, 2);
  });
});
