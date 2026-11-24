import type { LyricLine } from './types';

const LRC_LINE_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Parses standard LRC format `[mm:ss.xx] Lyric text` into sorted LyricLine[].
 */
export function parseLrcLyrics(lrcText: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') return [];

  const parsed: LyricLine[] = [];
  const rawLines = lrcText.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    LRC_LINE_REGEX.lastIndex = 0;

    while ((match = LRC_LINE_REGEX.exec(rawLine)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fracRaw = match[3] || '0';
      const fracSeconds =
        fracRaw.length === 3
          ? Number(fracRaw) / 1000
          : fracRaw.length === 2
          ? Number(fracRaw) / 100
          : Number(fracRaw) / 10;

      timestamps.push(minutes * 60 + seconds + fracSeconds);
    }

    if (timestamps.length === 0) continue;

    const text = rawLine.replace(LRC_LINE_REGEX, '').trim();
    if (!text) continue;

    for (const timeSec of timestamps) {
      parsed.push({ timeSec, text });
    }
  }

  return parsed.sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Returns the index of the currently active synced lyric line for `currentTimeSec`.
 */
export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTimeSec: number
): number {
  if (lines.length === 0) return -1;
  if (currentTimeSec < lines[0].timeSec) return -1;

  let low = 0;
  let high = lines.length - 1;
  let active = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeSec <= currentTimeSec + 0.15) {
      active = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return active;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
