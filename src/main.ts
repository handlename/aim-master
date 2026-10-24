import { createInitialGameState, startCountdown, stepGame } from './core/game';
import { clampPoint } from './core/geometry';
import {
  PLAYFIELD_BOUNDS,
  PermissionTarget,
  createInitialSensorState,
  requestSensorPermissions,
  resetCenter,
  shouldApplyPointerFallback,
  stepCrosshairFromMotion,
  stepCrosshairFromOrientation,
  updateSensorOptions,
} from './core/sensor';
import { DEFAULT_WAVES } from './core/waves';
import { RetroAudio } from './shell/audio';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, renderGame } from './shell/renderer';
import { ResultCardData, generateResultCardBlob, shareResult } from './shell/share';
import {
  clearBestTime,
  formatTimeSeconds,
  formatTimestamp,
  loadAimOptions,
  loadBestTime,
  saveAimOptions,
  saveBestTime,
  shouldResetBestFromSearch,
} from './shell/storage';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const titleOverlay = document.getElementById('title-overlay') as HTMLDivElement;
const resultOverlay = document.getElementById('result-overlay') as HTMLDivElement;
const optionsPanel = document.getElementById('options-panel') as HTMLElement;
const sensitivitySlider = document.getElementById('sensitivity-slider') as HTMLInputElement;
const sensitivityValue = document.getElementById('sensitivity-value') as HTMLSpanElement;
const invertXBtn = document.getElementById('invert-x-btn') as HTMLButtonElement;
const invertYBtn = document.getElementById('invert-y-btn') as HTMLButtonElement;
const resultHeading = document.getElementById('result-heading') as HTMLHeadingElement;
const resultTimestamp = document.getElementById('result-timestamp') as HTMLParagraphElement;
const resultCardImg = document.getElementById('result-card-img') as HTMLImageElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
const resetCenterBtn = document.getElementById('reset-center-btn') as HTMLButtonElement;

const audio = new RetroAudio();
if (shouldResetBestFromSearch(window.location.search)) {
  clearBestTime();
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('reset');
  window.history.replaceState({}, '', cleanUrl.toString());
}
const initialOptions = loadAimOptions();
let sensorState = createInitialSensorState(
  initialOptions.sensitivity,
  initialOptions.invertX,
  initialOptions.invertY
);
let gameState = createInitialGameState(loadBestTime());

let hasMotionEvents = false;
let isStartingRun = false;
let lastMotionTimestampMs: number | null = null;
let latestResultBlob: Blob | null = null;
let latestResultData: ResultCardData | null = null;

function isOptionsEditable(): boolean {
  return gameState.phase === 'TITLE' || gameState.phase === 'RESULT';
}

function syncOptionsUI(): void {
  sensitivitySlider.value = sensorState.sensitivity.toFixed(1);
  sensitivityValue.textContent = sensorState.sensitivity.toFixed(1);

  invertXBtn.setAttribute('aria-pressed', String(sensorState.invertX));
  invertXBtn.textContent = `REVERSE X: ${sensorState.invertX ? 'ON' : 'OFF'}`;

  invertYBtn.setAttribute('aria-pressed', String(sensorState.invertY));
  invertYBtn.textContent = `REVERSE Y: ${sensorState.invertY ? 'ON' : 'OFF'}`;
}

syncOptionsUI();

sensitivitySlider.addEventListener('input', () => {
  if (!isOptionsEditable()) {
    return;
  }
  const nextSens = Number(sensitivitySlider.value);
  sensorState = updateSensorOptions(sensorState, { sensitivity: nextSens });
  saveAimOptions({
    sensitivity: sensorState.sensitivity,
    invertX: sensorState.invertX,
    invertY: sensorState.invertY,
  });
  syncOptionsUI();
});

invertXBtn.addEventListener('click', () => {
  if (!isOptionsEditable()) {
    return;
  }
  sensorState = updateSensorOptions(sensorState, { invertX: !sensorState.invertX });
  saveAimOptions({
    sensitivity: sensorState.sensitivity,
    invertX: sensorState.invertX,
    invertY: sensorState.invertY,
  });
  syncOptionsUI();
});

invertYBtn.addEventListener('click', () => {
  if (!isOptionsEditable()) {
    return;
  }
  sensorState = updateSensorOptions(sensorState, { invertY: !sensorState.invertY });
  saveAimOptions({
    sensitivity: sensorState.sensitivity,
    invertX: sensorState.invertX,
    invertY: sensorState.invertY,
  });
  syncOptionsUI();
});

async function requestSensorPermissionsIfNeeded(): Promise<void> {
  const motionCtor =
    typeof DeviceMotionEvent !== 'undefined'
      ? (DeviceMotionEvent as unknown as PermissionTarget)
      : undefined;
  const orientCtor =
    typeof DeviceOrientationEvent !== 'undefined'
      ? (DeviceOrientationEvent as unknown as PermissionTarget)
      : undefined;
  await requestSensorPermissions(motionCtor, orientCtor);
}

window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
  const rot = event.rotationRate;
  if (!rot || (rot.alpha === null && rot.beta === null && rot.gamma === null)) {
    return;
  }
  hasMotionEvents = true;
  const now = performance.now();
  const dtSec =
    lastMotionTimestampMs !== null
      ? (now - lastMotionTimestampMs) / 1000
      : event.interval > 0
        ? event.interval / 1000
        : 0.016;
  lastMotionTimestampMs = now;

  const accG = event.accelerationIncludingGravity;
  sensorState = stepCrosshairFromMotion(sensorState, {
    alphaRate: rot.alpha,
    betaRate: rot.beta,
    gammaRate: rot.gamma,
    gx: accG?.x ?? null,
    gy: accG?.y ?? null,
    gz: accG?.z ?? null,
    dtSec,
  });
});

window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
  if (hasMotionEvents) {
    return;
  }
  sensorState = stepCrosshairFromOrientation(sensorState, {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
  });
});

function updateCrosshairFromPointer(clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }
  const logicalX = ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
  const logicalY = ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;

  sensorState = {
    ...sensorState,
    crosshair: clampPoint({ x: logicalX, y: logicalY }, PLAYFIELD_BOUNDS),
  };
}

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (shouldApplyPointerFallback(hasMotionEvents, e.pointerType, e.buttons)) {
    updateCrosshairFromPointer(e.clientX, e.clientY);
  }
});

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  if (shouldApplyPointerFallback(hasMotionEvents, e.pointerType, 1)) {
    updateCrosshairFromPointer(e.clientX, e.clientY);
  }
});

resetCenterBtn.addEventListener('click', () => {
  sensorState = resetCenter(sensorState);
});

async function beginGameRun(): Promise<void> {
  if (isStartingRun) {
    return;
  }
  isStartingRun = true;
  startBtn.disabled = true;
  retryBtn.disabled = true;
  try {
    audio.unlock();
    await requestSensorPermissionsIfNeeded();
    lastMotionTimestampMs = null;
    sensorState = resetCenter(sensorState);
    gameState = startCountdown(gameState, sensorState.crosshair);
    for (const ev of gameState.audioEvents) {
      audio.play(ev);
    }
    titleOverlay.classList.add('hidden');
    resultOverlay.classList.add('hidden');
    optionsPanel.classList.add('hidden');
  } finally {
    isStartingRun = false;
    startBtn.disabled = false;
    retryBtn.disabled = false;
  }
}

startBtn.addEventListener('click', () => {
  void beginGameRun();
});

retryBtn.addEventListener('click', () => {
  void beginGameRun();
});

shareBtn.addEventListener('click', () => {
  if (latestResultData && latestResultBlob) {
    void shareResult(latestResultData, latestResultBlob);
  }
});

async function handleEnterResult(state: typeof gameState): Promise<void> {
  if (state.bestTimeMs !== null && state.isNewRecord) {
    saveBestTime(state.bestTimeMs);
  }
  const clearedAt = formatTimestamp(new Date());
  const data: ResultCardData = {
    clearTimeMs: state.elapsedMs,
    bestTimeMs: state.bestTimeMs ?? state.elapsedMs,
    isNewRecord: state.isNewRecord,
    penaltyHits: state.penaltyHits,
    playDurationMs: state.playDurationMs,
    totalDistancePx: state.totalDistancePx,
    normalTargetHits: state.normalTargetHits,
    clearedAt,
    fullTrace: state.fullTrace,
  };
  latestResultData = data;
  resultHeading.textContent = state.isNewRecord
    ? `★ NEW RECORD! ${formatTimeSeconds(state.elapsedMs)}s ★`
    : `CLEAR! ${formatTimeSeconds(state.elapsedMs)}s`;
  resultHeading.classList.toggle('new-record', state.isNewRecord);
  resultTimestamp.textContent = `${clearedAt} | PENALTY: ${state.penaltyHits}`;

  try {
    const { blob, dataUrl } = await generateResultCardBlob(data);
    latestResultBlob = blob;
    resultCardImg.src = dataUrl;
  } catch {
    // Ignore image generation failure in non-canvas environments
  }
  resultOverlay.classList.remove('hidden');
  optionsPanel.classList.remove('hidden');
}

let lastFrameTimeMs = performance.now();

function frameLoop(nowMs: number): void {
  const dtMs = nowMs - lastFrameTimeMs;
  lastFrameTimeMs = nowMs;

  const prevPhase = gameState.phase;
  gameState = stepGame(gameState, sensorState.crosshair, dtMs, DEFAULT_WAVES);

  for (const ev of gameState.audioEvents) {
    audio.play(ev);
  }

  if (prevPhase !== 'RESULT' && gameState.phase === 'RESULT') {
    void handleEnterResult(gameState);
  }

  renderGame(ctx, gameState, DEFAULT_WAVES.length, nowMs);
  requestAnimationFrame(frameLoop);
}

renderGame(ctx, gameState, DEFAULT_WAVES.length, performance.now());
requestAnimationFrame(frameLoop);
