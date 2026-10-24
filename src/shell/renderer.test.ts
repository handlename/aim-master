import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState, startCountdown, stepGame } from '../core/game';
import { DEFAULT_WAVES } from '../core/waves';
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  computeFireworkParticles,
  renderGame,
} from './renderer';

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('renderer', () => {
  it('exports 240x272 logical resolution (32px HUD + 240x240 square playfield) and renders states cleanly', () => {
    expect(LOGICAL_WIDTH).toBe(240);
    expect(LOGICAL_HEIGHT).toBe(272);

    const ctx = createMockCanvasContext();
    let state = createInitialGameState(4500);
    renderGame(ctx, state, DEFAULT_WAVES.length);

    state = startCountdown(state);
    renderGame(ctx, state, DEFAULT_WAVES.length);

    state = stepGame(state, { x: 40, y: 80 }, 2000, DEFAULT_WAVES);
    renderGame(ctx, state, DEFAULT_WAVES.length);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('generates firework particles and renders fireworks when phase is RESULT with isNewRecord', () => {
    const particles = computeFireworkParticles(500);
    expect(particles.length).toBeGreaterThan(10);

    const ctx = createMockCanvasContext();
    const baseState = createInitialGameState(5000);
    const newRecordResultState = {
      ...baseState,
      phase: 'RESULT' as const,
      elapsedMs: 4200,
      bestTimeMs: 4200,
      isNewRecord: true,
    };

    renderGame(ctx, newRecordResultState, DEFAULT_WAVES.length, 500);
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
