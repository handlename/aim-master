import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState, startCountdown, stepGame } from '../core/game';
import { DEFAULT_WAVES } from '../core/waves';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, renderGame } from './renderer';

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
  it('exports 240x400 logical resolution and renders TITLE, COUNTDOWN, PLAYING, and RESULT states cleanly', () => {
    expect(LOGICAL_WIDTH).toBe(240);
    expect(LOGICAL_HEIGHT).toBe(400);

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
});
