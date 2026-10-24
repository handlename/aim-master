import { Point, Rect, clampPoint } from './geometry';

export interface MotionSample {
  readonly alphaRate: number | null;
  readonly betaRate: number | null;
  readonly gammaRate: number | null;
  readonly gx: number | null;
  readonly gy: number | null;
  readonly gz: number | null;
  readonly dtSec: number;
}

export interface OrientationSample {
  readonly alpha: number | null;
  readonly beta: number | null;
  readonly gamma: number | null;
}

export interface SensorState {
  readonly crosshair: Point;
  readonly sensitivity: number;
  readonly lastOrientation: OrientationSample | null;
}

export const PLAYFIELD_BOUNDS: Rect = {
  minX: 8,
  minY: 40,
  maxX: 232,
  maxY: 352,
};

export const PLAYFIELD_CENTER: Point = {
  x: 120,
  y: 196,
};

const MAX_DT_SEC = 0.05;
const DEFAULT_SENSITIVITY = 4.5;

export function createInitialSensorState(sensitivity: number = DEFAULT_SENSITIVITY): SensorState {
  return {
    crosshair: PLAYFIELD_CENTER,
    sensitivity,
    lastOrientation: null,
  };
}

export function resetCenter(state: SensorState): SensorState {
  return {
    ...state,
    crosshair: PLAYFIELD_CENTER,
    lastOrientation: null,
  };
}

function shortestAngleDeltaDeg(curr: number, prev: number): number {
  return ((((curr - prev) % 360) + 540) % 360) - 180;
}

export function stepCrosshairFromMotion(
  state: SensorState,
  sample: MotionSample,
  bounds: Rect = PLAYFIELD_BOUNDS
): SensorState {
  const dt = Math.min(MAX_DT_SEC, Math.max(0, sample.dtSec));
  if (dt === 0) {
    return state;
  }

  // In W3C / WebKit DeviceMotionEvent.rotationRate:
  // - alphaRate is rotation around the device's horizontal X-axis (pitching top of phone up/down -> vertical screen Y).
  // - betaRate is rotation around the device's vertical Y-axis (panning phone left/right when held vertically -> horizontal screen X).
  // - gammaRate is rotation around the device's perpendicular Z-axis.
  const rawHorizDegPerSec = -(sample.betaRate ?? 0) - (sample.gammaRate ?? 0);
  const rawVertDegPerSec = -(sample.alphaRate ?? 0);

  // Use gravity vector (gx, gy) on the screen plane to compensate if the phone is held slightly tilted (roll).
  // In upright portrait posture, gravity points along -Y (gx ≈ 0, gy ≈ -9.8).
  const gx = sample.gx ?? 0;
  const gy = sample.gy ?? 0;
  const gMag = Math.hypot(gx, gy);

  let cosRoll = 1;
  let sinRoll = 0;
  if (gMag > 0.1) {
    // Upright unit down vector is (0, -1). Actual down vector is (gx / gMag, gy / gMag).
    cosRoll = -gy / gMag;
    sinRoll = gx / gMag;
  }

  const worldHorizRate = rawHorizDegPerSec * cosRoll - rawVertDegPerSec * sinRoll;
  const worldVertRate = rawHorizDegPerSec * sinRoll + rawVertDegPerSec * cosRoll;

  const dx = worldHorizRate * dt * state.sensitivity;
  const dy = worldVertRate * dt * state.sensitivity;

  const nextCrosshair = clampPoint(
    {
      x: state.crosshair.x + dx,
      y: state.crosshair.y + dy,
    },
    bounds
  );

  return {
    ...state,
    crosshair: nextCrosshair,
  };
}

export interface PermissionTarget {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export async function requestSensorPermissions(
  motionTarget?: PermissionTarget,
  orientationTarget?: PermissionTarget
): Promise<boolean> {
  if (motionTarget && typeof motionTarget.requestPermission === 'function') {
    try {
      const result = await motionTarget.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  if (orientationTarget && typeof orientationTarget.requestPermission === 'function') {
    try {
      const result = await orientationTarget.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }

  return true;
}

export function shouldApplyPointerFallback(
  hasMotionEvents: boolean,
  pointerType: string,
  buttons: number
): boolean {
  if (hasMotionEvents) {
    return false;
  }
  return pointerType === 'mouse' || buttons > 0;
}

export function stepCrosshairFromOrientation(
  state: SensorState,
  sample: OrientationSample,
  bounds: Rect = PLAYFIELD_BOUNDS
): SensorState {
  if (sample.alpha === null && sample.beta === null && sample.gamma === null) {
    return state;
  }

  const prev = state.lastOrientation;
  if (!prev) {
    return {
      ...state,
      lastOrientation: sample,
    };
  }

  const dAlpha =
    sample.alpha !== null && prev.alpha !== null
      ? shortestAngleDeltaDeg(sample.alpha, prev.alpha)
      : 0;
  const dBeta =
    sample.beta !== null && prev.beta !== null
      ? shortestAngleDeltaDeg(sample.beta, prev.beta)
      : 0;
  const dGamma =
    sample.gamma !== null && prev.gamma !== null
      ? shortestAngleDeltaDeg(sample.gamma, prev.gamma)
      : 0;

  const dx = (-dAlpha - dGamma) * state.sensitivity;
  const dy = -dBeta * state.sensitivity;

  const nextCrosshair = clampPoint(
    {
      x: state.crosshair.x + dx,
      y: state.crosshair.y + dy,
    },
    bounds
  );

  return {
    ...state,
    crosshair: nextCrosshair,
    lastOrientation: sample,
  };
}
