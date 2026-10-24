import { AimOptions, DEFAULT_SENSITIVITY, clampSensitivity } from '../core/sensor';

export const BEST_TIME_STORAGE_KEY = 'aim_master_best_time_ms';
export const OPTIONS_STORAGE_KEY = 'aim_master_options';

export function loadAimOptions(
  storage: Pick<Storage, 'getItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): AimOptions {
  const defaultOptions: AimOptions = {
    sensitivity: DEFAULT_SENSITIVITY,
    invertX: false,
    invertY: false,
  };
  if (!storage) {
    return defaultOptions;
  }
  try {
    const raw = storage.getItem(OPTIONS_STORAGE_KEY);
    if (!raw) {
      return defaultOptions;
    }
    const parsed = JSON.parse(raw) as Partial<AimOptions>;
    return {
      sensitivity:
        typeof parsed.sensitivity === 'number'
          ? clampSensitivity(parsed.sensitivity)
          : DEFAULT_SENSITIVITY,
      invertX: Boolean(parsed.invertX),
      invertY: Boolean(parsed.invertY),
    };
  } catch {
    return defaultOptions;
  }
}

export function saveAimOptions(
  options: AimOptions,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      OPTIONS_STORAGE_KEY,
      JSON.stringify({
        sensitivity: clampSensitivity(options.sensitivity),
        invertX: Boolean(options.invertX),
        invertY: Boolean(options.invertY),
      })
    );
  } catch {
    // Ignore storage errors
  }
}

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

export function clearBestTime(
  storage: Pick<Storage, 'removeItem'> | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : undefined
): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(BEST_TIME_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function shouldResetBestFromSearch(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return params.get('reset') === '1';
  } catch {
    return false;
  }
}

export function formatTimeSeconds(timeMs: number): string {
  const safeMs = Math.max(0, Number.isFinite(timeMs) ? timeMs : 0);
  const seconds = safeMs / 1000;
  const formatted = seconds.toFixed(3);
  return seconds < 10 ? `0${formatted}` : formatted;
}

export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
