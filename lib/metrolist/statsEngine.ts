/**
 * Pure listening analytics, Year-in-Music Recap, local library search, and sort engine
 * inspired by ArchiveTune's StatsScreen.kt, YearInMusicScreen.kt, and LocalSearchScreen.kt.
 */

import type { PlayEvent, Track, UserPlaylist } from './types';

export type StatsPeriod = 'week' | 'month' | 'year' | 'all';

export interface TopArtistStat {
  name: string;
  playCount: number;
  minutes: number;
  sharePct: number;
  thumbnail: string;
}

export interface TopSongStat {
  track: Track;
  playCount: number;
  minutes: number;
}

export interface ListeningStats {
  period: StatsPeriod;
  totalPlays: number;
  totalMinutes: number;
  uniqueTracks: number;
  uniqueArtists: number;
  likedCount: number;
  playlistsCount: number;
  topSongs: TopSongStat[];
  topArtists: TopArtistStat[];
  weekdayPlays: number[]; // index 0 = Mon .. 6 = Sun
  hourPlays: number[]; // index 0..23
  peakHour: number;
  peakHourLabel: string;
  listeningPersona: {
    title: string;
    description: string;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterHistoryByPeriod(
  history: PlayEvent[],
  period: StatsPeriod,
  nowMs = Date.now()
): PlayEvent[] {
  if (period === 'all') return history;
  const windowMs =
    period === 'week'
      ? 7 * DAY_MS
      : period === 'month'
        ? 30 * DAY_MS
        : 365 * DAY_MS;
  const cutoff = nowMs - windowMs;
  return history.filter((ev) => ev.lastPlayedAt >= cutoff);
}

export function formatHourLabel(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function computeListeningStats(params: {
  history: PlayEvent[];
  likedCount: number;
  playlistsCount: number;
  period: StatsPeriod;
  nowMs?: number;
}): ListeningStats {
  const nowMs = params.nowMs ?? Date.now();
  const filtered = filterHistoryByPeriod(params.history, params.period, nowMs);

  const weekdayPlays = [0, 0, 0, 0, 0, 0, 0];
  const hourPlays = Array.from({ length: 24 }, () => 0);

  let totalPlays = 0;
  let totalSec = 0;

  const artistMap = new Map<
    string,
    { name: string; playCount: number; sec: number; thumbnail: string }
  >();
  const songList: TopSongStat[] = [];

  for (const ev of filtered) {
    const plays = Math.max(1, ev.playCount);
    const durSec = ev.track.duration && ev.track.duration > 0 ? ev.track.duration : 210;
    const trackSec = plays * durSec;

    totalPlays += plays;
    totalSec += trackSec;

    songList.push({
      track: ev.track,
      playCount: plays,
      minutes: Math.max(1, Math.round(trackSec / 60)),
    });

    const artistName = ev.track.artist || 'Unknown Artist';
    const existingArtist = artistMap.get(artistName);
    if (existingArtist) {
      existingArtist.playCount += plays;
      existingArtist.sec += trackSec;
    } else {
      artistMap.set(artistName, {
        name: artistName,
        playCount: plays,
        sec: trackSec,
        thumbnail: ev.track.thumbnail,
      });
    }

    // Distribute activity across weekday & hour buckets deterministically from lastPlayedAt
    const d = new Date(ev.lastPlayedAt);
    const jsDay = d.getDay(); // 0=Sun..6=Sat
    const monIdx = jsDay === 0 ? 6 : jsDay - 1;
    const hr = d.getHours();
    weekdayPlays[monIdx] += plays;
    hourPlays[hr] += plays;
  }

  songList.sort((a, b) => b.playCount - a.playCount);

  const rawArtists = Array.from(artistMap.values()).sort(
    (a, b) => b.playCount - a.playCount
  );
  const topArtists: TopArtistStat[] = rawArtists.slice(0, 6).map((a) => ({
    name: a.name,
    playCount: a.playCount,
    minutes: Math.max(1, Math.round(a.sec / 60)),
    sharePct: totalPlays > 0 ? Math.round((a.playCount / totalPlays) * 100) : 0,
    thumbnail: a.thumbnail,
  }));

  let peakHour = 20;
  let peakVal = -1;
  for (let h = 0; h < 24; h++) {
    if (hourPlays[h] > peakVal) {
      peakVal = hourPlays[h];
      peakHour = h;
    }
  }

  const totalMinutes = Math.round(totalSec / 60);
  const uniqueTracks = filtered.length;
  const uniqueArtists = artistMap.size;

  const avgPlaysPerTrack = uniqueTracks > 0 ? totalPlays / uniqueTracks : 0;
  let listeningPersona = {
    title: 'Sonic Explorer',
    description: 'Always rotating fresh artists, genres, and late-night discoveries.',
  };
  if (peakHour >= 21 || peakHour < 5) {
    listeningPersona = {
      title: 'Midnight Audiophile',
      description: `Your sessions peak around ${formatHourLabel(peakHour)} with immersive nocturnal mixes.`,
    };
  } else if (peakHour >= 5 && peakHour < 11) {
    listeningPersona = {
      title: 'Morning Rhythm',
      description: `You set the tone early, peaking around ${formatHourLabel(peakHour)} every day.`,
    };
  } else if (avgPlaysPerTrack >= 4.5) {
    listeningPersona = {
      title: 'Replay Devotee',
      description: 'When a track clicks, you keep it on repeat until every lyric sticks.',
    };
  } else if (uniqueArtists >= 6) {
    listeningPersona = {
      title: 'Genre Wanderer',
      description: `Spinning ${uniqueArtists} distinct artists with balanced daily energy.`,
    };
  }

  return {
    period: params.period,
    totalPlays,
    totalMinutes,
    uniqueTracks,
    uniqueArtists,
    likedCount: params.likedCount,
    playlistsCount: params.playlistsCount,
    topSongs: songList.slice(0, 12),
    topArtists,
    weekdayPlays,
    hourPlays,
    peakHour,
    peakHourLabel: formatHourLabel(peakHour),
    listeningPersona,
  };
}

export interface LocalSearchResult {
  tracks: Track[];
  playlists: UserPlaylist[];
}

export function searchLocalLibrary(params: {
  query: string;
  likedTracks: Track[];
  history: PlayEvent[];
  playlists: UserPlaylist[];
}): LocalSearchResult {
  const q = params.query.trim().toLowerCase();
  if (!q) return { tracks: [], playlists: [] };

  const seenTrackIds = new Set<string>();
  const candidateTracks: Track[] = [];
  const pushUnique = (t: Track) => {
    if (seenTrackIds.has(t.videoId)) return;
    seenTrackIds.add(t.videoId);
    candidateTracks.push(t);
  };

  for (const t of params.likedTracks) pushUnique(t);
  for (const h of params.history) pushUnique(h.track);
  for (const pl of params.playlists) {
    for (const t of pl.tracks) pushUnique(t);
  }

  const matchedTracks = candidateTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album?.name?.toLowerCase().includes(q) ?? false)
  );

  const matchedPlaylists = params.playlists.filter(
    (pl) =>
      pl.name.toLowerCase().includes(q) ||
      (pl.description?.toLowerCase().includes(q) ?? false) ||
      (pl.tags?.some((tag) => tag.toLowerCase().includes(q)) ?? false)
  );

  return { tracks: matchedTracks, playlists: matchedPlaylists };
}

export type TrackSortMode = 'relevance' | 'title' | 'duration';
export type LibraryTrackSortMode = 'recent' | 'title' | 'artist' | 'duration' | 'mostPlayed';

export function sortTracksList(tracks: Track[], mode: TrackSortMode): Track[] {
  if (mode === 'relevance') return tracks;
  const copy = [...tracks];
  if (mode === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (mode === 'duration') {
    copy.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
  }
  return copy;
}

export function sortLibraryTracks(
  tracks: Track[],
  mode: LibraryTrackSortMode,
  history: PlayEvent[] = []
): Track[] {
  if (mode === 'recent') return tracks;
  const copy = [...tracks];
  if (mode === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (mode === 'artist') {
    copy.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  } else if (mode === 'duration') {
    copy.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
  } else if (mode === 'mostPlayed') {
    const playMap = new Map<string, number>();
    for (const ev of history) {
      playMap.set(ev.track.videoId, ev.playCount);
    }
    copy.sort((a, b) => (playMap.get(b.videoId) ?? 0) - (playMap.get(a.videoId) ?? 0));
  }
  return copy;
}

export function filterTracksByQuery(tracks: Track[], query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album?.name?.toLowerCase().includes(q) ?? false)
  );
}

export function computeTotalDurationSec(tracks: Track[]): number {
  return tracks.reduce((sum, t) => sum + (t.duration && t.duration > 0 ? t.duration : 0), 0);
}

export function formatLongDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0 min';
  const totalMins = Math.max(1, Math.round(totalSec / 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

export interface AutoTopMix {
  id: 'my-top-mix' | 'most-replayed' | 'rediscover';
  title: string;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
  tracks: Track[];
  covers: string[];
}

export function buildAutoTopMixes(
  history: PlayEvent[],
  likedTracks: Track[],
  nowMs = Date.now()
): AutoTopMix[] {
  const mixes: AutoTopMix[] = [];

  // 1. My Top Mix (blends top played + liked deduplicated)
  const sortedByPlays = [...history].sort((a, b) => b.playCount - a.playCount);
  const topMixSeen = new Set<string>();
  const topMixTracks: Track[] = [];
  for (const ev of sortedByPlays) {
    if (!topMixSeen.has(ev.track.videoId)) {
      topMixSeen.add(ev.track.videoId);
      topMixTracks.push(ev.track);
    }
  }
  for (const t of likedTracks) {
    if (!topMixSeen.has(t.videoId)) {
      topMixSeen.add(t.videoId);
      topMixTracks.push(t);
    }
  }
  if (topMixTracks.length > 0) {
    mixes.push({
      id: 'my-top-mix',
      title: 'My Top Mix',
      subtitle: `${topMixTracks.length} signature tracks`,
      accentFrom: '#E11D48',
      accentTo: '#4C0519',
      tracks: topMixTracks.slice(0, 50),
      covers: topMixTracks.slice(0, 4).map((t) => t.thumbnail).filter(Boolean),
    });
  }

  // 2. Most Replayed (highest play count tracks)
  const replayedTracks = sortedByPlays.filter((ev) => ev.playCount >= 2).map((ev) => ev.track);
  if (replayedTracks.length > 0) {
    mixes.push({
      id: 'most-replayed',
      title: 'On Repeat',
      subtitle: `${replayedTracks.length} heavy rotation picks`,
      accentFrom: '#7C3AED',
      accentTo: '#1E1B4B',
      tracks: replayedTracks.slice(0, 30),
      covers: replayedTracks.slice(0, 4).map((t) => t.thumbnail).filter(Boolean),
    });
  }

  // 3. Rediscover Gems (played 5+ days ago, or older favorites)
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  const olderPlayed = [...history]
    .filter((ev) => nowMs - ev.lastPlayedAt >= fiveDaysMs)
    .sort((a, b) => b.playCount - a.playCount)
    .map((ev) => ev.track);
  const rediscoverTracks =
    olderPlayed.length > 0
      ? olderPlayed
      : [...likedTracks].reverse().slice(0, 15);
  if (rediscoverTracks.length > 0) {
    mixes.push({
      id: 'rediscover',
      title: 'Rediscover',
      subtitle: `${rediscoverTracks.length} forgotten favorites`,
      accentFrom: '#0D9488',
      accentTo: '#042F2E',
      tracks: rediscoverTracks.slice(0, 25),
      covers: rediscoverTracks.slice(0, 4).map((t) => t.thumbnail).filter(Boolean),
    });
  }

  return mixes;
}

export const EQ_BAND_LABELS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'] as const;

export const EQUALIZER_PRESETS: Record<
  'FLAT' | 'BASS_BOOST' | 'VOCAL' | 'ACOUSTIC' | 'ELECTRONIC' | 'LATE_NIGHT',
  { label: string; description: string; bands: [number, number, number, number, number] }
> = {
  FLAT: {
    label: 'Flat',
    description: 'Studio reference response',
    bands: [0, 0, 0, 0, 0],
  },
  BASS_BOOST: {
    label: 'Bass Boost',
    description: 'Deep sub-bass & warm punch',
    bands: [6, 4, 0, 1, 2],
  },
  VOCAL: {
    label: 'Vocal Clarity',
    description: 'Crisp midrange & lyric focus',
    bands: [-2, 1, 4, 3, 1],
  },
  ACOUSTIC: {
    label: 'Acoustic',
    description: 'Natural strings & airy highs',
    bands: [2, 1, 1, 3, 4],
  },
  ELECTRONIC: {
    label: 'Electronic',
    description: 'V-shape club energy & sparkle',
    bands: [5, 2, -1, 3, 5],
  },
  LATE_NIGHT: {
    label: 'Late Night',
    description: 'Gentle low-volume warmth',
    bands: [3, 2, 0, -1, -2],
  },
};

export function clampEqBand(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(-12, Math.min(12, Math.round(db)));
}

