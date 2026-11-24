import type { PlayEvent, PlayerSettings, Track } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalizes and filters candidate tracks according to user preferences.
 * Always filters out duplicate videoIds and excludes VIDEO items when hideVideoSongs is enabled.
 */
export function filterTracksByPreferences(
  tracks: Track[],
  settings: Pick<PlayerSettings, 'hideVideoSongs'>
): Track[] {
  const seen = new Set<string>();
  const result: Track[] = [];

  for (const track of tracks) {
    if (!track.videoId || seen.has(track.videoId)) continue;
    if (settings.hideVideoSongs && track.type === 'VIDEO') continue;
    seen.add(track.videoId);
    result.push(track);
  }

  return result;
}

export interface QuickPicksInput {
  history: PlayEvent[];
  likedTracks: Track[];
  remoteCandidates: Track[];
  settings: Pick<PlayerSettings, 'hideVideoSongs'>;
  limit?: number;
  nowMs?: number;
}

/**
 * Metrolist-inspired Quick Picks algorithm:
 * 1. Combines weighted user listening history, liked tracks, and YouTube Music up-next/home candidates.
 * 2. Collects and scores ALL raw candidates first.
 * 3. Applies preference filtering (hideVideoSongs) BEFORE slicing to `limit` (PR #4520 pattern)
 *    so filtered video songs never leave empty or shortened recommendation shelves.
 */
export function buildQuickPicks({
  history,
  likedTracks,
  remoteCandidates,
  settings,
  limit = 12,
  nowMs = Date.now(),
}: QuickPicksInput): Track[] {
  const scoreMap = new Map<string, { track: Track; score: number }>();

  const upsert = (track: Track, delta: number) => {
    const existing = scoreMap.get(track.videoId);
    if (existing) {
      existing.score += delta;
      // Prefer SONG metadata if duplicate exists across sources
      if (existing.track.type === 'VIDEO' && track.type === 'SONG') {
        existing.track = track;
      }
    } else {
      scoreMap.set(track.videoId, { track, score: delta });
    }
  };

  for (const event of history) {
    const ageDays = Math.max(0, (nowMs - event.lastPlayedAt) / DAY_MS);
    const recencyWeight = 1 / (1 + ageDays * 0.25);
    const frequencyWeight = Math.min(12, Math.log2(event.playCount + 1) * 3.5);
    upsert(event.track, frequencyWeight * recencyWeight + 2);
  }

  for (const liked of likedTracks) {
    upsert(liked, 4.5);
  }

  // Remote up-next & curated candidates keep fresh discovery flowing
  remoteCandidates.forEach((candidate, idx) => {
    const rankBoost = Math.max(0.5, 4 - idx * 0.15);
    upsert(candidate, rankBoost);
  });

  const ranked = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);

  return filterTracksByPreferences(ranked, settings).slice(0, limit);
}

export interface KeepListeningInput {
  history: PlayEvent[];
  settings: Pick<PlayerSettings, 'hideVideoSongs'>;
  limit?: number;
  nowMs?: number;
}

/**
 * Metrolist Keep Listening:
 * Surfaces tracks the user actively spun recently so they can resume effortlessly.
 */
export function buildKeepListening({
  history,
  settings,
  limit = 10,
  nowMs = Date.now(),
}: KeepListeningInput): Track[] {
  const cutoff = nowMs - 30 * DAY_MS;
  const recent = history
    .filter((event) => event.lastPlayedAt >= cutoff)
    .sort((a, b) => {
      const scoreA = a.lastPlayedAt + a.playCount * 3600_000;
      const scoreB = b.lastPlayedAt + b.playCount * 3600_000;
      return scoreB - scoreA;
    })
    .map((e) => e.track);

  return filterTracksByPreferences(recent, settings).slice(0, limit);
}

export interface ForgottenFavoritesInput {
  history: PlayEvent[];
  likedTracks: Track[];
  settings: Pick<PlayerSettings, 'hideVideoSongs'>;
  cooldownDays?: number;
  recentSkipCount?: number;
  limit?: number;
  nowMs?: number;
}

/**
 * Metrolist Forgotten Favorites:
 * Finds once-loved tracks (playCount >= 2 or liked) that haven't been played recently.
 * Filters preferences BEFORE slicing to guarantee full shelf density.
 */
export function buildForgottenFavorites({
  history,
  likedTracks,
  settings,
  cooldownDays = 7,
  recentSkipCount = 10,
  limit = 10,
  nowMs = Date.now(),
}: ForgottenFavoritesInput): Track[] {
  const sortedByRecency = [...history].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  const veryRecentIds = new Set(
    sortedByRecency.slice(0, recentSkipCount).map((e) => e.track.videoId)
  );
  const likedSet = new Set(likedTracks.map((t) => t.videoId));
  const cooldownMs = cooldownDays * DAY_MS;

  const candidates: Array<{ track: Track; affinity: number }> = [];

  for (const event of history) {
    const isLiked = likedSet.has(event.track.videoId);
    const isOldEnough = nowMs - event.lastPlayedAt >= cooldownMs;
    const notRecentlyPlayed = !veryRecentIds.has(event.track.videoId);

    if ((event.playCount >= 2 || isLiked) && (isOldEnough || notRecentlyPlayed)) {
      const affinity = event.playCount * 2 + (isLiked ? 5 : 0);
      candidates.push({ track: event.track, affinity });
    }
  }

  // Also include liked tracks that aren't in the most recent plays
  for (const liked of likedTracks) {
    if (!veryRecentIds.has(liked.videoId) && !candidates.some((c) => c.track.videoId === liked.videoId)) {
      candidates.push({ track: liked, affinity: 3 });
    }
  }

  candidates.sort((a, b) => b.affinity - a.affinity);
  return filterTracksByPreferences(
    candidates.map((c) => c.track),
    settings
  ).slice(0, limit);
}

/**
 * Picks up to 8 speed dial tracks/items for the Metrolist top 2x4 grid.
 */
export function buildSpeedDial({
  history,
  likedTracks,
  remoteCandidates,
  settings,
  limit = 8,
}: {
  history: PlayEvent[];
  likedTracks: Track[];
  remoteCandidates: Track[];
  settings: Pick<PlayerSettings, 'hideVideoSongs'>;
  limit?: number;
}): Track[] {
  const mostPlayed = [...history]
    .sort((a, b) => b.playCount - a.playCount)
    .map((e) => e.track);

  const combined = [...mostPlayed, ...likedTracks, ...remoteCandidates];
  return filterTracksByPreferences(combined, settings).slice(0, limit);
}
