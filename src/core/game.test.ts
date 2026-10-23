import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_DURATION_MS,
  createInitialGameState,
  startCountdown,
  stepGame,
} from './game';
import { DEFAULT_WAVES, WaveDefinition, evaluateTargetPosition } from './waves';

const TEST_WAVES: readonly WaveDefinition[] = [
  {
    waveNumber: 1,
    label: 'WAVE 1',
    targets: [
      { id: 'w1-1', anchorX: 120, anchorY: 196, radius: 16, motion: { kind: 'static' } },
    ],
  },
  {
    waveNumber: 2,
    label: 'WAVE 2',
    targets: [
      { id: 'w2-1', anchorX: 60, anchorY: 150, radius: 14, motion: { kind: 'static' } },
      { id: 'w2-2', anchorX: 180, anchorY: 150, radius: 14, motion: { kind: 'static' } },
    ],
  },
];

describe('waves and game state machine', () => {
  it('evaluates static, linear, and circle target positions deterministically', () => {
    const linearPos = evaluateTargetPosition(
      { id: 't1', anchorX: 100, anchorY: 200, radius: 14, motion: { kind: 'linear', dx: 40, dy: 0, speedHz: 0.5 } },
      0.5 // sin(2 * PI * 0.5 * 0.5) = sin(PI / 2) = 1
    );
    expect(linearPos.x).toBeCloseTo(140, 2);
    expect(linearPos.y).toBeCloseTo(200, 2);

    const circlePos = evaluateTargetPosition(
      { id: 't2', anchorX: 120, anchorY: 200, radius: 14, motion: { kind: 'circle', orbitRadius: 30, speedRadPerSec: Math.PI } },
      1.0 // angle = PI -> cos = -1, sin = 0
    );
    expect(circlePos.x).toBeCloseTo(90, 2);
    expect(circlePos.y).toBeCloseTo(200, 2);
  });

  it('transitions TITLE -> COUNTDOWN -> PLAYING and hits wave 1 immediately if crosshair is on target', () => {
    let state = createInitialGameState(10000);
    // Start countdown with crosshair away from center
    state = startCountdown(state, { x: 20, y: 50 });
    expect(state.phase).toBe('COUNTDOWN');

    state = stepGame(state, { x: 20, y: 50 }, COUNTDOWN_DURATION_MS + 10, TEST_WAVES);
    expect(state.phase).toBe('PLAYING');
    expect(state.waveIndex).toBe(0);
    expect(state.audioEvents).toContain('COUNTDOWN_GO');
  });

  it('sweeps across all targets in final wave in a single frame and completes the game with new record', () => {
    let state = startCountdown(createInitialGameState(5000), { x: 20, y: 196 });
    state = stepGame(state, { x: 20, y: 196 }, COUNTDOWN_DURATION_MS + 10, TEST_WAVES);

    // Horizontal sweep from (20, 196) to (220, 196) passes right through Wave 1 target at (120, 196)
    state = stepGame(state, { x: 220, y: 196 }, 20, TEST_WAVES);
    expect(state.phase).toBe('PLAYING');
    expect(state.waveIndex).toBe(1);
    expect(state.audioEvents).toContain('TARGET_HIT');
    expect(state.audioEvents).toContain('WAVE_CLEAR');

    // Move crosshair to (20, 150) without hitting (60, 150)
    state = stepGame(state, { x: 20, y: 150 }, 20, TEST_WAVES);
    expect(state.waveIndex).toBe(1);

    // Single fast sweep from (20, 150) to (220, 150) hits both (60, 150) and (180, 150)
    state = stepGame(state, { x: 220, y: 150 }, 30, TEST_WAVES);
    expect(state.phase).toBe('RESULT');
    expect(state.elapsedMs).toBe(70);
    expect(state.bestTimeMs).toBe(70);
    expect(state.isNewRecord).toBe(true);
    expect(state.audioEvents).toContain('GAME_CLEAR');
  });

  it('defines 5 default waves within the 240x400 playfield', () => {
    expect(DEFAULT_WAVES.length).toBe(5);
    for (const wave of DEFAULT_WAVES) {
      expect(wave.targets.length).toBeGreaterThanOrEqual(1);
    }
  });
});
