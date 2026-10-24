import { describe, expect, it } from 'vitest';
import {
  formatTimeSeconds,
  formatTimestamp,
  loadAimOptions,
  loadBestTime,
  saveAimOptions,
  saveBestTime,
} from './storage';
import { buildShareText, buildXIntentUrl } from './share';

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

    const text = buildShareText(
      {
        clearTimeMs: 4823,
        bestTimeMs: 4823,
        isNewRecord: true,
        clearedAt: ts,
        fullTrace: [],
      },
      'https://example.com/aim-master'
    );
    expect(text).toContain('04.823s');
    expect(text).toContain('NEW RECORD');
    expect(buildXIntentUrl(text)).toContain('https://twitter.com/intent/tweet?text=');
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
});
