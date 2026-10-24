export const BEST_TIME_STORAGE_KEY = 'aim_master_best_time_ms';

export function loadBestTime(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): number | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(BEST_TIME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveBestTime(
  timeMs: number,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): void {
  if (!storage || !Number.isFinite(timeMs) || timeMs <= 0) {
    return;
  }
  try {
    storage.setItem(BEST_TIME_STORAGE_KEY, String(Math.round(timeMs)));
  } catch {
    // Ignore storage quota / privacy errors in private browsing mode
  }
}

export function formatTimeSeconds(timeMs: number): string {
  const safeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
  const seconds = safeMs / 1000;
  const formatted = seconds.toFixed(3);
  return seconds < 10 ? `0${formatted}` : formatted;
}
