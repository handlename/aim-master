import { Point, segmentCircleIntersect } from './geometry';
import { PLAYFIELD_CENTER } from './sensor';
import {
  DEFAULT_WAVES,
  TargetBlueprint,
  WaveDefinition,
  evaluateTargetPosition,
} from './waves';

export type GamePhase = 'TITLE' | 'COUNTDOWN' | 'PLAYING' | 'RESULT';

export type GameAudioEvent =
  | 'COUNTDOWN_TICK'
  | 'COUNTDOWN_GO'
  | 'TARGET_HIT'
  | 'PENALTY_HIT'
  | 'WAVE_CLEAR'
  | 'GAME_CLEAR';

export interface ActiveTarget {
  readonly blueprint: TargetBlueprint;
  readonly position: Point;
  readonly hit: boolean;
}

export interface HitEffect {
  readonly position: Point;
  readonly remainingMs: number;
  readonly kind?: 'normal' | 'penalty';
}

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
  readonly ageMs: number;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly countdownRemainingMs: number;
  readonly waveIndex: number;
  readonly waveElapsedMs: number;
  readonly elapsedMs: number;
  readonly bestTimeMs: number | null;
  readonly isNewRecord: boolean;
  readonly crosshair: Point;
  readonly targets: readonly ActiveTarget[];
  readonly hitEffects: readonly HitEffect[];
  readonly recentTrail: readonly TrailPoint[];
  readonly fullTrace: readonly Point[];
  readonly audioEvents: readonly GameAudioEvent[];
}

export const CROSSHAIR_HIT_RADIUS = 4;
export const COUNTDOWN_DURATION_MS = 1800;

const HIT_EFFECT_DURATION_MS = 260;
const TRAIL_MAX_AGE_MS = 180;
const MAX_FULL_TRACE_POINTS = 600;
const MAX_PLAYING_DT_MS = 50;

export function isPenaltyTarget(blueprint: TargetBlueprint): boolean {
  return (blueprint.penaltyMs ?? 0) > 0;
}

function areAllNormalTargetsHit(targets: readonly ActiveTarget[]): boolean {
  const normalTargets = targets.filter((t) => !isPenaltyTarget(t.blueprint));
  return normalTargets.length > 0 && normalTargets.every((t) => t.hit);
}

function spawnWaveTargets(wave: WaveDefinition): readonly ActiveTarget[] {
  return wave.targets.map((blueprint) => ({
    blueprint,
    position: evaluateTargetPosition(blueprint, 0),
    hit: false,
  }));
}

export function createInitialGameState(bestTimeMs: number | null): GameState {
  return {
    phase: 'TITLE',
    countdownRemainingMs: 0,
    waveIndex: 0,
    waveElapsedMs: 0,
    elapsedMs: 0,
    bestTimeMs,
    isNewRecord: false,
    crosshair: PLAYFIELD_CENTER,
    targets: [],
    hitEffects: [],
    recentTrail: [],
    fullTrace: [],
    audioEvents: [],
  };
}

export function startCountdown(
  state: GameState,
  initialCrosshair: Point = PLAYFIELD_CENTER
): GameState {
  return {
    ...state,
    phase: 'COUNTDOWN',
    countdownRemainingMs: COUNTDOWN_DURATION_MS,
    waveIndex: 0,
    waveElapsedMs: 0,
    elapsedMs: 0,
    isNewRecord: false,
    crosshair: initialCrosshair,
    targets: [],
    hitEffects: [],
    recentTrail: [{ x: initialCrosshair.x, y: initialCrosshair.y, ageMs: 0 }],
    fullTrace: [initialCrosshair],
    audioEvents: ['COUNTDOWN_TICK'],
  };
}

function updateTrail(
  recentTrail: readonly TrailPoint[],
  nextCrosshair: Point,
  dtMs: number
): readonly TrailPoint[] {
  const aged = recentTrail
    .map((pt) => ({ ...pt, ageMs: pt.ageMs + dtMs }))
    .filter((pt) => pt.ageMs <= TRAIL_MAX_AGE_MS);
  return [...aged, { x: nextCrosshair.x, y: nextCrosshair.y, ageMs: 0 }];
}

function evaluateSweptHits(
  targets: readonly ActiveTarget[],
  prevCrosshair: Point,
  nextCrosshair: Point,
  waveElapsedSec: number
): {
  readonly updatedTargets: readonly ActiveTarget[];
  readonly newlyHitNormalPositions: readonly Point[];
  readonly newlyHitPenaltyPositions: readonly Point[];
  readonly addedPenaltyMs: number;
} {
  const newlyHitNormalPositions: Point[] = [];
  const newlyHitPenaltyPositions: Point[] = [];
  let addedPenaltyMs = 0;

  const updatedTargets = targets.map((target) => {
    const position = evaluateTargetPosition(target.blueprint, waveElapsedSec);
    if (target.hit) {
      return { ...target, position };
    }
    const hitRadius = target.blueprint.radius + CROSSHAIR_HIT_RADIUS;
    const isHit = segmentCircleIntersect(prevCrosshair, nextCrosshair, position, hitRadius);
    if (isHit) {
      if (isPenaltyTarget(target.blueprint)) {
        newlyHitPenaltyPositions.push(position);
        addedPenaltyMs += target.blueprint.penaltyMs ?? 0;
      } else {
        newlyHitNormalPositions.push(position);
      }
      return { ...target, position, hit: true };
    }
    return { ...target, position };
  });

  return {
    updatedTargets,
    newlyHitNormalPositions,
    newlyHitPenaltyPositions,
    addedPenaltyMs,
  };
}

export function stepGame(
  state: GameState,
  nextCrosshair: Point,
  dtMs: number,
  waves: readonly WaveDefinition[] = DEFAULT_WAVES
): GameState {
  if (state.phase === 'TITLE' || state.phase === 'RESULT') {
    return {
      ...state,
      crosshair: nextCrosshair,
      recentTrail: updateTrail(state.recentTrail, nextCrosshair, Math.min(50, Math.max(0, dtMs))),
      audioEvents: [],
    };
  }

  if (state.phase === 'COUNTDOWN') {
    const safeDt = Math.max(0, dtMs);
    const prevBucket = Math.ceil(state.countdownRemainingMs / 600);
    const nextRemaining = state.countdownRemainingMs - safeDt;
    const nextBucket = Math.ceil(Math.max(0, nextRemaining) / 600);
    const audioEvents: GameAudioEvent[] = [];

    if (nextRemaining > 0) {
      if (nextBucket < prevBucket && nextBucket >= 1) {
        audioEvents.push('COUNTDOWN_TICK');
      }
      return {
        ...state,
        countdownRemainingMs: nextRemaining,
        crosshair: nextCrosshair,
        recentTrail: updateTrail(state.recentTrail, nextCrosshair, Math.min(50, safeDt)),
        audioEvents,
      };
    }

    // Transition to PLAYING on Wave 0
    audioEvents.push('COUNTDOWN_GO');
    const firstWave = waves[0];
    const initialTargets = firstWave ? spawnWaveTargets(firstWave) : [];
    const {
      updatedTargets,
      newlyHitNormalPositions,
      newlyHitPenaltyPositions,
      addedPenaltyMs,
    } = evaluateSweptHits(initialTargets, nextCrosshair, nextCrosshair, 0);

    if (newlyHitNormalPositions.length > 0) {
      audioEvents.push('TARGET_HIT');
    }
    if (newlyHitPenaltyPositions.length > 0) {
      audioEvents.push('PENALTY_HIT');
    }

    const hitEffects: HitEffect[] = [
      ...newlyHitNormalPositions.map((position) => ({
        position,
        remainingMs: HIT_EFFECT_DURATION_MS,
        kind: 'normal' as const,
      })),
      ...newlyHitPenaltyPositions.map((position) => ({
        position,
        remainingMs: HIT_EFFECT_DURATION_MS,
        kind: 'penalty' as const,
      })),
    ];

    if (areAllNormalTargetsHit(updatedTargets) && waves.length > 1) {
      audioEvents.push('WAVE_CLEAR');
      return {
        ...state,
        phase: 'PLAYING',
        countdownRemainingMs: 0,
        waveIndex: 1,
        waveElapsedMs: 0,
        elapsedMs: addedPenaltyMs,
        crosshair: nextCrosshair,
        targets: spawnWaveTargets(waves[1]),
        hitEffects,
        recentTrail: updateTrail(state.recentTrail, nextCrosshair, 16),
        fullTrace: [nextCrosshair],
        audioEvents,
      };
    }

    return {
      ...state,
      phase: 'PLAYING',
      countdownRemainingMs: 0,
      waveIndex: 0,
      waveElapsedMs: 0,
      elapsedMs: addedPenaltyMs,
      crosshair: nextCrosshair,
      targets: updatedTargets,
      hitEffects,
      recentTrail: updateTrail(state.recentTrail, nextCrosshair, 16),
      fullTrace: [nextCrosshair],
      audioEvents,
    };
  }

  // state.phase === 'PLAYING'
  const clampedDt = Math.min(MAX_PLAYING_DT_MS, Math.max(0, dtMs));
  const nextWaveElapsedMs = state.waveElapsedMs + clampedDt;
  const waveElapsedSec = nextWaveElapsedMs / 1000;

  const {
    updatedTargets,
    newlyHitNormalPositions,
    newlyHitPenaltyPositions,
    addedPenaltyMs,
  } = evaluateSweptHits(state.targets, state.crosshair, nextCrosshair, waveElapsedSec);

  const nextElapsedMs = state.elapsedMs + clampedDt + addedPenaltyMs;

  const audioEvents: GameAudioEvent[] = [];
  if (newlyHitNormalPositions.length > 0) {
    audioEvents.push('TARGET_HIT');
  }
  if (newlyHitPenaltyPositions.length > 0) {
    audioEvents.push('PENALTY_HIT');
  }

  const agedEffects = state.hitEffects
    .map((ef) => ({ ...ef, remainingMs: ef.remainingMs - clampedDt }))
    .filter((ef) => ef.remainingMs > 0);
  const hitEffects: readonly HitEffect[] = [
    ...agedEffects,
    ...newlyHitNormalPositions.map((position) => ({
      position,
      remainingMs: HIT_EFFECT_DURATION_MS,
      kind: 'normal' as const,
    })),
    ...newlyHitPenaltyPositions.map((position) => ({
      position,
      remainingMs: HIT_EFFECT_DURATION_MS,
      kind: 'penalty' as const,
    })),
  ];

  const nextTrail = updateTrail(state.recentTrail, nextCrosshair, clampedDt);
  const nextFullTrace =
    state.fullTrace.length < MAX_FULL_TRACE_POINTS
      ? [...state.fullTrace, nextCrosshair]
      : state.fullTrace;

  if (!areAllNormalTargetsHit(updatedTargets)) {
    return {
      ...state,
      elapsedMs: nextElapsedMs,
      waveElapsedMs: nextWaveElapsedMs,
      crosshair: nextCrosshair,
      targets: updatedTargets,
      hitEffects,
      recentTrail: nextTrail,
      fullTrace: nextFullTrace,
      audioEvents,
    };
  }

  const nextWaveIndex = state.waveIndex + 1;
  if (nextWaveIndex < waves.length) {
    audioEvents.push('WAVE_CLEAR');
    return {
      ...state,
      waveIndex: nextWaveIndex,
      waveElapsedMs: 0,
      elapsedMs: nextElapsedMs,
      crosshair: nextCrosshair,
      targets: spawnWaveTargets(waves[nextWaveIndex]),
      hitEffects,
      recentTrail: nextTrail,
      fullTrace: nextFullTrace,
      audioEvents,
    };
  }

  // Final wave cleared -> RESULT
  audioEvents.push('GAME_CLEAR');
  const isNewRecord = state.bestTimeMs === null || nextElapsedMs < state.bestTimeMs;
  const nextBestTimeMs = isNewRecord ? nextElapsedMs : state.bestTimeMs;

  return {
    ...state,
    phase: 'RESULT',
    elapsedMs: nextElapsedMs,
    waveElapsedMs: nextWaveElapsedMs,
    bestTimeMs: nextBestTimeMs,
    isNewRecord,
    crosshair: nextCrosshair,
    targets: updatedTargets,
    hitEffects,
    recentTrail: nextTrail,
    fullTrace: nextFullTrace,
    audioEvents,
  };
}
