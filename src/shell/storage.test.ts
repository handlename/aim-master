import { describe, expect, it } from 'vitest';
import { formatTimeSeconds, loadBestTime, saveBestTime } from './storage';
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

  it('builds share text and X intent URL', () => {
    const text = buildShareText(
      { clearTimeMs: 4823, bestTimeMs: 4823, isNewRecord: true, fullTrace: [] },
      'https://example.com/aim-master'
    );
    expect(text).toContain('04.823s');
    expect(text).toContain('NEW RECORD');
    expect(buildXIntentUrl(text)).toContain('https://twitter.com/intent/tweet?text=');
  });
});
