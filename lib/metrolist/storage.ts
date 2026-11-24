import { createInitialSeedState, DEFAULT_SETTINGS } from './seed';
import type { PlayEvent, PlayerSettings, Track, UserPlaylist } from './types';

const KEYS = {
  HISTORY: 'Poelys_play_history_v1',
  LIKED: 'Poelys_liked_tracks_v1',
  PLAYLISTS: 'Poelys_user_playlists_v1',
  SETTINGS: 'Poelys_settings_v1',
  SEARCH_HISTORY: 'Poelys_search_history_v1',
  SAVED_COLLECTION: 'Poelys_saved_collection_v1',
};

export interface SavedCollectionItem {
  kind: 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  savedAt: number;
}

export interface PersistedLibraryState {
  history: PlayEvent[];
  likedTracks: Track[];
  playlists: UserPlaylist[];
  settings: PlayerSettings;
  searchHistory: string[];
  savedCollection: SavedCollectionItem[];
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadLibraryState(): PersistedLibraryState {
  if (typeof window === 'undefined') {
    const seed = createInitialSeedState();
    return {
      ...seed,
      settings: DEFAULT_SETTINGS,
      searchHistory: ['Daft Punk', 'The Weeknd', 'Lofi Chill'],
      savedCollection: [],
    };
  }

  const hasExisting =
    window.localStorage.getItem(KEYS.PLAYLISTS) !== null ||
    window.localStorage.getItem(KEYS.HISTORY) !== null;

  if (!hasExisting) {
    const seed = createInitialSeedState();
    saveHistory(seed.history);
    saveLikedTracks(seed.likedTracks);
    savePlaylists(seed.playlists);
    saveSettings(DEFAULT_SETTINGS);
    saveSearchHistory(['Daft Punk', 'The Weeknd', 'Lofi Chill']);
    return {
      ...seed,
      settings: DEFAULT_SETTINGS,
      searchHistory: ['Daft Punk', 'The Weeknd', 'Lofi Chill'],
      savedCollection: [],
    };
  }

  const seed = createInitialSeedState();
  return {
    history: safeParse<PlayEvent[]>(
      window.localStorage.getItem(KEYS.HISTORY),
      seed.history
    ),
    likedTracks: safeParse<Track[]>(
      window.localStorage.getItem(KEYS.LIKED),
      seed.likedTracks
    ),
    playlists: safeParse<UserPlaylist[]>(
      window.localStorage.getItem(KEYS.PLAYLISTS),
      seed.playlists
    ),
    settings: {
      ...DEFAULT_SETTINGS,
      ...safeParse<Partial<PlayerSettings>>(
        window.localStorage.getItem(KEYS.SETTINGS),
        {}
      ),
    },
    searchHistory: safeParse<string[]>(
      window.localStorage.getItem(KEYS.SEARCH_HISTORY),
      ['Daft Punk', 'The Weeknd', 'Lofi Chill']
    ),
    savedCollection: safeParse<SavedCollectionItem[]>(
      window.localStorage.getItem(KEYS.SAVED_COLLECTION),
      []
    ),
  };
}

export function saveHistory(history: PlayEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 120)));
  } catch {
    // ignore quota errors
  }
}

export function saveLikedTracks(tracks: Track[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.LIKED, JSON.stringify(tracks));
  } catch {
    // ignore quota errors
  }
}

export function savePlaylists(playlists: UserPlaylist[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(playlists));
  } catch {
    // ignore quota errors
  }
}

export function saveSettings(settings: PlayerSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function saveSearchHistory(queries: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEYS.SEARCH_HISTORY,
      JSON.stringify(queries.slice(0, 12))
    );
  } catch {
    // ignore quota errors
  }
}

export function saveCollection(items: SavedCollectionItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEYS.SAVED_COLLECTION, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function recordTrackPlay(
  history: PlayEvent[],
  track: Track,
  nowMs = Date.now()
): PlayEvent[] {
  const idx = history.findIndex((e) => e.track.videoId === track.videoId);
  if (idx >= 0) {
    const existing = history[idx];
    const updated: PlayEvent = {
      track,
      playCount: existing.playCount + 1,
      lastPlayedAt: nowMs,
      firstPlayedAt: existing.firstPlayedAt,
    };
    return [updated, ...history.filter((_, i) => i !== idx)];
  }
  return [
    {
      track,
      playCount: 1,
      lastPlayedAt: nowMs,
      firstPlayedAt: nowMs,
    },
    ...history,
  ];
}
