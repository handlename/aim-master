import { describe, expect, it, vi } from 'vitest';
import {
  clearBestTime,
  formatTimeSeconds,
  formatTimestamp,
  loadAimOptions,
  loadBestTime,
  saveAimOptions,
  saveBestTime,
  shouldResetBestFromSearch,
} from './storage';
import {
  buildShareText,
  buildXIntentUrl,
  formatAimStats,
  renderResultCardToCanvas,
} from './share';

describe('storage and share helpers', () => {
  it('loads valid best time and rejects corrupt or negative localStorage values', () => {
    expect(loadBestTime({ getItem: () => '4820' })).toBe(4820);
    expect(loadBestTime({ getItem: () => null })).toBeNull();
    expect(loadBestTime({ getItem: () => 'NaN' })).toBeNull();
    expect(loadBestTime({ getItem: () => '-100' })).toBeNull();
    expect(loadBestTime({ getItem: () => 'abc' })).toBeNull();
  });

  it('saves rounded positive best time to storage', () => {
    let saved = '';
    saveBestTime(4823.7, { setItem: (_k, v) => { saved = v; } });
    expect(saved).toBe('4824');
  });

  it('formats milliseconds as SS.mmm 3-decimal seconds string (1/1000s precision)', () => {
    expect(formatTimeSeconds(4823)).toBe('04.823');
    expect(formatTimeSeconds(12345)).toBe('12.345');
    expect(formatTimeSeconds(50)).toBe('00.050');
  });

  it('builds share text and X intent URL and formats timestamp', () => {
    const ts = formatTimestamp(new Date(2026, 9, 24, 10, 40, 5));
    expect(ts).toBe('2026-10-24 10:40:05');

    const text = buildShareText({ clearTimeMs: 4823 });
    expect(text).toBe(
      'BOOM! NEW HIGH SCORE! 🎯🔥\nTIME: 04.823s\nAIM MASTER #AIMMASTER\nhttps://handlename.github.io/aim-master/'
    );
    expect(buildXIntentUrl(text)).toContain('https://twitter.com/intent/tweet?text=');
    expect(buildXIntentUrl(text)).toContain(
      encodeURIComponent('https://handlename.github.io/aim-master/')
    );
  });

  it('saves and loads aim options (sensitivity, invertX, invertY) with fallback for corrupt data', () => {
    let stored = '';
    saveAimOptions(
      { sensitivity: 8.5, invertX: true, invertY: false },
      { setItem: (_k, v) => { stored = v; } }
    );
    const loaded = loadAimOptions({ getItem: () => stored });
    expect(loaded).toEqual({ sensitivity: 8.5, invertX: true, invertY: false });

    const fallback = loadAimOptions({ getItem: () => '{bad json' });
    expect(fallback).toEqual({ sensitivity: 6.0, invertX: false, invertY: false });
  });

  it('detects ?reset=1 query parameter and clears stored best time', () => {
    expect(shouldResetBestFromSearch('?reset=1')).toBe(true);
    expect(shouldResetBestFromSearch('?foo=bar&reset=1')).toBe(true);
    expect(shouldResetBestFromSearch('?reset=0')).toBe(false);
    expect(shouldResetBestFromSearch('')).toBe(false);

    let removedKey = '';
    clearBestTime({ removeItem: (k) => { removedKey = k; } });
    expect(removedKey).toBe('aim_master_best_time_ms');
  });

  it('formats subtle aim stats (average speed and average hit interval) and renders them on the result card', () => {
    // 2100 px covered over 5000 ms (5.0s) across 25 normal targets:
    // avg speed = 420 px/s, avg interval = 5.0 / 25 = 0.20s
    const stats = formatAimStats({
      clearTimeMs: 6000,
      playDurationMs: 5000,
      totalDistancePx: 2100,
      normalTargetHits: 25,
    });
    expect(stats.avgSpeedLabel).toBe('AVG SPEED: 420 px/s');
    expect(stats.avgIntervalLabel).toBe('AVG SPLIT: 0.20s');

    // Guard against zero duration or zero hits
    const zeroStats = formatAimStats({
      clearTimeMs: 0,
      playDurationMs: 0,
      totalDistancePx: 0,
      normalTargetHits: 0,
    });
    expect(zeroStats.avgSpeedLabel).toBe('AVG SPEED: 0 px/s');
    expect(zeroStats.avgIntervalLabel).toBe('AVG SPLIT: --.--s');

    const fillTextCalls: string[] = [];
    const mockCtx = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textBaseline: 'alphabetic',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn((text: string) => {
        fillTextCalls.push(text);
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    renderResultCardToCanvas(mockCtx, {
      clearTimeMs: 6000,
      bestTimeMs: 5500,
      isNewRecord: false,
      penaltyHits: 1,
      playDurationMs: 5000,
      totalDistancePx: 2100,
      normalTargetHits: 25,
      clearedAt: '2026-10-24 15:40:00',
      fullTrace: [{ x: 120, y: 152 }, { x: 140, y: 160 }],
    });

    expect(fillTextCalls).toContain('AVG SPEED: 420 px/s');
    expect(fillTextCalls).toContain('AVG SPLIT: 0.20s');
  });
});
