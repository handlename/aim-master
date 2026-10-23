import { Point } from './geometry';

export type TargetMotion =
  | { readonly kind: 'static' }
  | {
      readonly kind: 'linear';
      readonly dx: number;
      readonly dy: number;
      readonly speedHz: number;
      readonly phaseRad?: number;
    }
  | {
      readonly kind: 'circle';
      readonly orbitRadius: number;
      readonly speedRadPerSec: number;
      readonly phaseRad?: number;
    };

export interface TargetBlueprint {
  readonly id: string;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly radius: number;
  readonly motion: TargetMotion;
}

export interface WaveDefinition {
  readonly waveNumber: number;
  readonly label: string;
  readonly targets: readonly TargetBlueprint[];
}

export const DEFAULT_WAVES: readonly WaveDefinition[] = [
  {
    waveNumber: 1,
    label: 'WAVE 1',
    targets: [
      {
        id: 'w1-center',
        anchorX: 120,
        anchorY: 165,
        radius: 18,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 2,
    label: 'WAVE 2',
    targets: [
      {
        id: 'w2-left',
        anchorX: 60,
        anchorY: 140,
        radius: 16,
        motion: { kind: 'static' },
      },
      {
        id: 'w2-right',
        anchorX: 180,
        anchorY: 220,
        radius: 16,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 3,
    label: 'WAVE 3',
    targets: [
      {
        id: 'w3-top',
        anchorX: 120,
        anchorY: 95,
        radius: 15,
        motion: { kind: 'linear', dx: 55, dy: 0, speedHz: 0.7 },
      },
      {
        id: 'w3-bottom-left',
        anchorX: 65,
        anchorY: 255,
        radius: 15,
        motion: { kind: 'static' },
      },
      {
        id: 'w3-bottom-right',
        anchorX: 175,
        anchorY: 255,
        radius: 15,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 4,
    label: 'WAVE 4',
    targets: [
      {
        id: 'w4-1',
        anchorX: 70,
        anchorY: 120,
        radius: 14,
        motion: { kind: 'linear', dx: 0, dy: 45, speedHz: 0.85, phaseRad: 0 },
      },
      {
        id: 'w4-2',
        anchorX: 170,
        anchorY: 120,
        radius: 14,
        motion: { kind: 'linear', dx: 0, dy: 45, speedHz: 0.85, phaseRad: Math.PI },
      },
      {
        id: 'w4-3',
        anchorX: 120,
        anchorY: 265,
        radius: 15,
        motion: { kind: 'linear', dx: 60, dy: 0, speedHz: 0.9 },
      },
    ],
  },
  {
    waveNumber: 5,
    label: 'FINAL WAVE',
    targets: [
      {
        id: 'w5-orbit-1',
        anchorX: 120,
        anchorY: 170,
        radius: 14,
        motion: { kind: 'circle', orbitRadius: 52, speedRadPerSec: 2.8, phaseRad: 0 },
      },
      {
        id: 'w5-orbit-2',
        anchorX: 120,
        anchorY: 170,
        radius: 14,
        motion: { kind: 'circle', orbitRadius: 52, speedRadPerSec: 2.8, phaseRad: Math.PI },
      },
      {
        id: 'w5-corner-tl',
        anchorX: 48,
        anchorY: 85,
        radius: 13,
        motion: { kind: 'static' },
      },
      {
        id: 'w5-corner-br',
        anchorX: 192,
        anchorY: 285,
        radius: 13,
        motion: { kind: 'static' },
      },
    ],
  },
];

export function evaluateTargetPosition(
  blueprint: TargetBlueprint,
  waveElapsedSec: number
): Point {
  const { anchorX, anchorY, motion } = blueprint;
  switch (motion.kind) {
    case 'static':
      return { x: anchorX, y: anchorY };
    case 'linear': {
      const phase = motion.phaseRad ?? 0;
      const offset = Math.sin(2 * Math.PI * motion.speedHz * waveElapsedSec + phase);
      return {
        x: anchorX + motion.dx * offset,
        y: anchorY + motion.dy * offset,
      };
    }
    case 'circle': {
      const phase = motion.phaseRad ?? 0;
      const angle = motion.speedRadPerSec * waveElapsedSec + phase;
      return {
        x: anchorX + motion.orbitRadius * Math.cos(angle),
        y: anchorY + motion.orbitRadius * Math.sin(angle),
      };
    }
  }
}
