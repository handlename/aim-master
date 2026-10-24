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
  readonly penaltyMs?: number;
  readonly motion: TargetMotion;
}

export interface WaveDefinition {
  readonly waveNumber: number;
  readonly label: string;
  readonly targets: readonly TargetBlueprint[];
}

// Square playfield: x in 0..240 (bounds 8..232, center 120), y in 32..272 (bounds 40..264, center 152)
export const DEFAULT_WAVES: readonly WaveDefinition[] = [
  {
    waveNumber: 1,
    label: 'WAVE 1',
    targets: [
      {
        id: 'w1-center',
        anchorX: 120,
        anchorY: 152,
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
        anchorX: 64,
        anchorY: 120,
        radius: 16,
        motion: { kind: 'static' },
      },
      {
        id: 'w2-right',
        anchorX: 176,
        anchorY: 184,
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
        anchorY: 84,
        radius: 15,
        motion: { kind: 'static' },
      },
      {
        id: 'w3-bottom-left',
        anchorX: 60,
        anchorY: 214,
        radius: 15,
        motion: { kind: 'static' },
      },
      {
        id: 'w3-bottom-right',
        anchorX: 180,
        anchorY: 214,
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
        id: 'w4-slider-top',
        anchorX: 120,
        anchorY: 108,
        radius: 15,
        motion: { kind: 'linear', dx: 60, dy: 0, speedHz: 0.65, phaseRad: 0 },
      },
      {
        id: 'w4-slider-bottom',
        anchorX: 120,
        anchorY: 196,
        radius: 15,
        motion: { kind: 'linear', dx: 60, dy: 0, speedHz: 0.65, phaseRad: Math.PI },
      },
    ],
  },
  {
    waveNumber: 5,
    label: 'WAVE 5',
    targets: [
      {
        id: 'w5-tl',
        anchorX: 56,
        anchorY: 88,
        radius: 14,
        motion: { kind: 'static' },
      },
      {
        id: 'w5-tr',
        anchorX: 184,
        anchorY: 88,
        radius: 14,
        motion: { kind: 'static' },
      },
      {
        id: 'w5-bl',
        anchorX: 56,
        anchorY: 216,
        radius: 14,
        motion: { kind: 'static' },
      },
      {
        id: 'w5-br',
        anchorX: 184,
        anchorY: 216,
        radius: 14,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 6,
    label: 'WAVE 6',
    targets: [
      {
        id: 'w6-left-vert',
        anchorX: 60,
        anchorY: 152,
        radius: 14,
        motion: { kind: 'linear', dx: 0, dy: 56, speedHz: 0.75, phaseRad: 0 },
      },
      {
        id: 'w6-top',
        anchorX: 120,
        anchorY: 84,
        radius: 14,
        motion: { kind: 'static' },
      },
      {
        id: 'w6-right-vert',
        anchorX: 180,
        anchorY: 152,
        radius: 14,
        motion: { kind: 'linear', dx: 0, dy: 56, speedHz: 0.75, phaseRad: Math.PI },
      },
      {
        id: 'w6-penalty-center',
        anchorX: 120,
        anchorY: 158,
        radius: 14,
        penaltyMs: 1000,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 7,
    label: 'WAVE 7',
    targets: [
      {
        id: 'w7-orbit-1',
        anchorX: 120,
        anchorY: 152,
        radius: 14,
        motion: { kind: 'circle', orbitRadius: 58, speedRadPerSec: 2.4, phaseRad: 0 },
      },
      {
        id: 'w7-orbit-2',
        anchorX: 120,
        anchorY: 152,
        radius: 14,
        motion: {
          kind: 'circle',
          orbitRadius: 58,
          speedRadPerSec: 2.4,
          phaseRad: (2 * Math.PI) / 3,
        },
      },
      {
        id: 'w7-orbit-3',
        anchorX: 120,
        anchorY: 152,
        radius: 14,
        motion: {
          kind: 'circle',
          orbitRadius: 58,
          speedRadPerSec: 2.4,
          phaseRad: (4 * Math.PI) / 3,
        },
      },
      {
        id: 'w7-penalty-hub',
        anchorX: 120,
        anchorY: 152,
        radius: 14,
        penaltyMs: 1000,
        motion: { kind: 'static' },
      },
    ],
  },
  {
    waveNumber: 8,
    label: 'WAVE 8',
    targets: [
      {
        id: 'w8-diag-1',
        anchorX: 120,
        anchorY: 146,
        radius: 13,
        motion: { kind: 'linear', dx: 62, dy: 34, speedHz: 0.85, phaseRad: 0 },
      },
      {
        id: 'w8-diag-2',
        anchorX: 120,
        anchorY: 204,
        radius: 13,
        motion: { kind: 'linear', dx: -62, dy: 28, speedHz: 0.85, phaseRad: Math.PI / 2 },
      },
      {
        id: 'w8-top-sniper',
        anchorX: 120,
        anchorY: 70,
        radius: 12,
        motion: { kind: 'static' },
      },
      {
        id: 'w8-penalty-guard',
        anchorX: 120,
        anchorY: 108,
        radius: 13,
        penaltyMs: 1000,
        motion: { kind: 'linear', dx: 50, dy: 0, speedHz: 0.9, phaseRad: Math.PI / 4 },
      },
    ],
  },
  {
    waveNumber: 9,
    label: 'WAVE 9',
    targets: [
      {
        id: 'w9-ring-outer-1',
        anchorX: 120,
        anchorY: 152,
        radius: 13,
        motion: { kind: 'circle', orbitRadius: 66, speedRadPerSec: 2.5, phaseRad: 0 },
      },
      {
        id: 'w9-ring-outer-2',
        anchorX: 120,
        anchorY: 152,
        radius: 13,
        motion: {
          kind: 'circle',
          orbitRadius: 66,
          speedRadPerSec: 2.5,
          phaseRad: (2 * Math.PI) / 3,
        },
      },
      {
        id: 'w9-ring-outer-3',
        anchorX: 120,
        anchorY: 152,
        radius: 13,
        motion: {
          kind: 'circle',
          orbitRadius: 66,
          speedRadPerSec: 2.5,
          phaseRad: (4 * Math.PI) / 3,
        },
      },
      {
        id: 'w9-penalty-inner-1',
        anchorX: 120,
        anchorY: 152,
        radius: 12,
        penaltyMs: 1000,
        motion: { kind: 'circle', orbitRadius: 28, speedRadPerSec: -3.0, phaseRad: Math.PI / 2 },
      },
      {
        id: 'w9-penalty-inner-2',
        anchorX: 120,
        anchorY: 152,
        radius: 12,
        penaltyMs: 1000,
        motion: {
          kind: 'circle',
          orbitRadius: 28,
          speedRadPerSec: -3.0,
          phaseRad: (3 * Math.PI) / 2,
        },
      },
    ],
  },
  {
    waveNumber: 10,
    label: 'FINAL WAVE',
    targets: [
      {
        id: 'w10-center-boss',
        anchorX: 120,
        anchorY: 152,
        radius: 12,
        motion: { kind: 'circle', orbitRadius: 52, speedRadPerSec: 3.2, phaseRad: 0 },
      },
      {
        id: 'w10-orbit-twin',
        anchorX: 120,
        anchorY: 152,
        radius: 12,
        motion: { kind: 'circle', orbitRadius: 52, speedRadPerSec: 3.2, phaseRad: Math.PI },
      },
      {
        id: 'w10-top-runner',
        anchorX: 120,
        anchorY: 72,
        radius: 12,
        motion: { kind: 'linear', dx: 66, dy: 0, speedHz: 1.0, phaseRad: 0 },
      },
      {
        id: 'w10-bottom-runner',
        anchorX: 120,
        anchorY: 232,
        radius: 12,
        motion: { kind: 'linear', dx: 66, dy: 0, speedHz: 1.0, phaseRad: Math.PI },
      },
      {
        id: 'w10-penalty-core',
        anchorX: 120,
        anchorY: 152,
        radius: 13,
        penaltyMs: 1000,
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
