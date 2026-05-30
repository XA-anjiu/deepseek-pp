import { estimateTokenUnits } from '../token/estimator';

export interface ResponseTokenSpeedPayload {
  active: boolean;
  estimatedTokens: number;
  tokensPerSecond: number;
  elapsedMs: number;
  textLength: number;
}

export interface ResponseTokenSpeedTracker {
  append(text: string): void;
  finish(): void;
}

export function createResponseTokenSpeedTracker(
  onProgress: (progress: ResponseTokenSpeedPayload) => void,
  emitIntervalMs: number,
): ResponseTokenSpeedTracker {
  const startedAt = performance.now();
  let lastEmitAt = 0;
  let totalTokenUnits = 0;
  let textLength = 0;
  let finished = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  const getAverageTokensPerSecond = (now: number): number => {
    const elapsedMs = Math.max(now - startedAt, 1);
    return totalTokenUnits / (elapsedMs / 1000);
  };

  const emit = (active: boolean, force = false) => {
    if (finished && active) return;

    const now = performance.now();
    if (!force && now - lastEmitAt < emitIntervalMs) return;
    lastEmitAt = now;

    const elapsedMs = Math.max(now - startedAt, 1);
    onProgress({
      active,
      estimatedTokens: Math.round(totalTokenUnits),
      tokensPerSecond: getAverageTokensPerSecond(now),
      elapsedMs: Math.round(elapsedMs),
      textLength,
    });
  };

  emit(true, true);
  tickTimer = setInterval(() => emit(true, true), emitIntervalMs);

  return {
    append(text: string) {
      if (!text) return;
      const tokenUnits = estimateTokenUnits(text);
      textLength += text.length;
      totalTokenUnits += tokenUnits;
      emit(true);
    },
    finish() {
      if (finished) return;
      finished = true;
      if (tickTimer !== null) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
      emit(false, true);
    },
  };
}
