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

export interface AimOptions {
  readonly sensitivity: number;
  readonly invertX: boolean;
  readonly invertY: boolean;
}

export interface SensorState {
  readonly crosshair: Point;
  readonly sensitivity: number;
  readonly invertX: boolean;
  readonly invertY: boolean;
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
export const DEFAULT_SENSITIVITY = 6.0;
export const MIN_SENSITIVITY = 2.0;
export const MAX_SENSITIVITY = 14.0;

export function clampSensitivity(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SENSITIVITY;
  }
  return Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, Math.round(value * 2) / 2));
}

export function createInitialSensorState(
  sensitivity: number = DEFAULT_SENSITIVITY,
  invertX: boolean = false,
  invertY: boolean = false
): SensorState {
  return {
    crosshair: PLAYFIELD_CENTER,
    sensitivity: clampSensitivity(sensitivity),
    invertX,
    invertY,
    lastOrientation: null,
  };
}

export function updateSensorOptions(
  state: SensorState,
  options: Partial<AimOptions>
): SensorState {
  return {
    ...state,
    sensitivity:
      options.sensitivity !== undefined ? clampSensitivity(options.sensitivity) : state.sensitivity,
    invertX: options.invertX !== undefined ? options.invertX : state.invertX,
    invertY: options.invertY !== undefined ? options.invertY : state.invertY,
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
  // - betaRate is rotation around the device's vertical Y-axis (panning phone left/right when held vertically).
  // - gammaRate is rotation around the device's perpendicular Z-axis (yaw component when phone is pitched up/down).
  const alphaRate = sample.alphaRate ?? 0;
  const betaRate = sample.betaRate ?? 0;
  const gammaRate = sample.gammaRate ?? 0;

  const gx = sample.gx ?? 0;
  const gy = sample.gy ?? 0;
  const gz = sample.gz ?? 0;
  const gMag3D = Math.hypot(gx, gy, gz);
  const gyzMag = Math.hypot(gy, gz);

  // Project horizontal world yaw onto the phone's YZ gravity plane so betaRate and gammaRate
  // always combine constructively regardless of whether the phone is tilted forward or backward.
  const rawHorizDegPerSec =
    gyzMag > 0.1 ? (gy * betaRate + gz * gammaRate) / gyzMag : -betaRate - gammaRate;

  // Compensate for light-gun tangent ray projection (d(tan θ)/dθ = 1 / cos^2 θ) when pitched up/down,
  // preventing perceived loss of vertical/horizontal movement when aiming near the top of the screen.
  const cosPitch = gMag3D > 0.1 ? Math.abs(gy) / gMag3D : 1;
  const pitchRayGain = 1 / Math.max(0.55, cosPitch * cosPitch);

  const rawVertDegPerSec = -alphaRate * pitchRayGain;
  const boostedHorizDegPerSec = rawHorizDegPerSec * Math.sqrt(pitchRayGain);

  // Compute screen roll using 3D gravity magnitude so pitching into Z never shrinks cosRoll.
  let cosRoll = 1;
  let sinRoll = 0;
  if (gMag3D > 0.1) {
    sinRoll = Math.min(0.98, Math.max(-0.98, gx / gMag3D));
    cosRoll = Math.sqrt(1 - sinRoll * sinRoll) * (gy <= 0 ? 1 : -1);
  }

  const worldHorizRate = boostedHorizDegPerSec * cosRoll - rawVertDegPerSec * sinRoll;
  const worldVertRate = boostedHorizDegPerSec * sinRoll + rawVertDegPerSec * cosRoll;

  const dirX = state.invertX ? -1 : 1;
  const dirY = state.invertY ? -1 : 1;
  const dx = worldHorizRate * dt * state.sensitivity * dirX;
  const dy = worldVertRate * dt * state.sensitivity * dirY;

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

  const dirX = state.invertX ? -1 : 1;
  const dirY = state.invertY ? -1 : 1;
  const dx = (-dAlpha - dGamma) * state.sensitivity * dirX;
  const dy = -dBeta * state.sensitivity * dirY;

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
