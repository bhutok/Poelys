import { filterTracksByPreferences } from './recommendations';
import type { PlayerSettings, RepeatMode, Track } from './types';

export interface QueueState {
  queue: Track[];
  originalQueue: Track[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export function createQueueState(): QueueState {
  return {
    queue: [],
    originalQueue: [],
    currentIndex: -1,
    shuffle: false,
    repeat: 'off',
  };
}

export function getCurrentTrack(state: QueueState): Track | null {
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) {
    return null;
  }
  return state.queue[state.currentIndex];
}

function fisherYatesShuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function playTrackInQueue(
  state: QueueState,
  track: Track,
  contextTracks?: Track[],
  rng: () => number = Math.random
): QueueState {
  const baseList =
    contextTracks && contextTracks.length > 0
      ? contextTracks
      : [track];

  // Ensure the selected track exists in baseList
  const existingIdx = baseList.findIndex((t) => t.videoId === track.videoId);
  const normalizedList = existingIdx >= 0 ? [...baseList] : [track, ...baseList];

  if (state.shuffle) {
    const others = normalizedList.filter((t) => t.videoId !== track.videoId);
    const shuffled = [track, ...fisherYatesShuffle(others, rng)];
    return {
      ...state,
      originalQueue: normalizedList,
      queue: shuffled,
      currentIndex: 0,
    };
  }

  const targetIndex = normalizedList.findIndex((t) => t.videoId === track.videoId);
  return {
    ...state,
    originalQueue: normalizedList,
    queue: normalizedList,
    currentIndex: Math.max(0, targetIndex),
  };
}

export function insertPlayNext(state: QueueState, track: Track): QueueState {
  if (state.queue.length === 0 || state.currentIndex < 0) {
    return playTrackInQueue(state, track, [track]);
  }

  const current = getCurrentTrack(state);
  if (current && current.videoId === track.videoId) {
    return state;
  }

  // Remove any existing occurrence outside current index so we don't duplicate
  const filtered: Track[] = [];
  let newCurrentIndex = state.currentIndex;

  state.queue.forEach((item, idx) => {
    if (item.videoId === track.videoId && idx !== state.currentIndex) {
      if (idx < state.currentIndex) {
        newCurrentIndex -= 1;
      }
      return;
    }
    filtered.push(item);
  });

  const insertAt = Math.min(filtered.length, newCurrentIndex + 1);
  filtered.splice(insertAt, 0, track);

  const originalExists = state.originalQueue.some((t) => t.videoId === track.videoId);
  const nextOriginal = originalExists ? state.originalQueue : [...state.originalQueue, track];

  return {
    ...state,
    queue: filtered,
    originalQueue: nextOriginal,
    currentIndex: newCurrentIndex,
  };
}

export function appendToQueue(state: QueueState, track: Track): QueueState {
  if (state.queue.length === 0 || state.currentIndex < 0) {
    return playTrackInQueue(state, track, [track]);
  }

  if (state.queue.some((t) => t.videoId === track.videoId)) {
    return state;
  }

  return {
    ...state,
    queue: [...state.queue, track],
    originalQueue: [...state.originalQueue, track],
  };
}

export function removeFromQueue(state: QueueState, index: number): QueueState {
  if (index < 0 || index >= state.queue.length) return state;

  const removed = state.queue[index];
  const nextQueue = state.queue.filter((_, idx) => idx !== index);
  const nextOriginal = state.originalQueue.filter((t) => t.videoId !== removed.videoId);

  if (nextQueue.length === 0) {
    return {
      ...state,
      queue: [],
      originalQueue: [],
      currentIndex: -1,
    };
  }

  let nextIndex = state.currentIndex;
  if (index < state.currentIndex) {
    nextIndex -= 1;
  } else if (index === state.currentIndex) {
    nextIndex = Math.min(state.currentIndex, nextQueue.length - 1);
  }

  return {
    ...state,
    queue: nextQueue,
    originalQueue: nextOriginal,
    currentIndex: nextIndex,
  };
}

export function reorderQueue(
  state: QueueState,
  fromIndex: number,
  toIndex: number
): QueueState {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.queue.length ||
    toIndex >= state.queue.length ||
    fromIndex === toIndex
  ) {
    return state;
  }

  const activeTrack = getCurrentTrack(state);
  const nextQueue = [...state.queue];
  const [moved] = nextQueue.splice(fromIndex, 1);
  nextQueue.splice(toIndex, 0, moved);

  const nextIndex = activeTrack
    ? nextQueue.findIndex((t) => t.videoId === activeTrack.videoId)
    : state.currentIndex;

  return {
    ...state,
    queue: nextQueue,
    currentIndex: nextIndex,
  };
}

/**
 * Metrolist Shuffle Logic:
 * Enabling shuffle keeps the currently playing track pinned at index 0
 * and shuffles the remaining tracks. Disabling restores originalQueue and
 * updates currentIndex to match the playing track.
 */
export function toggleShuffleQueue(
  state: QueueState,
  rng: () => number = Math.random
): QueueState {
  const activeTrack = getCurrentTrack(state);

  if (!state.shuffle) {
    if (!activeTrack) {
      return {
        ...state,
        shuffle: true,
        queue: fisherYatesShuffle(state.queue, rng),
      };
    }
    const others = state.originalQueue.filter(
      (t) => t.videoId !== activeTrack.videoId
    );
    return {
      ...state,
      shuffle: true,
      queue: [activeTrack, ...fisherYatesShuffle(others, rng)],
      currentIndex: 0,
    };
  }

  if (!activeTrack) {
    return {
      ...state,
      shuffle: false,
      queue: [...state.originalQueue],
      currentIndex: state.originalQueue.length > 0 ? 0 : -1,
    };
  }

  const restoredIndex = state.originalQueue.findIndex(
    (t) => t.videoId === activeTrack.videoId
  );

  return {
    ...state,
    shuffle: false,
    queue: [...state.originalQueue],
    currentIndex: restoredIndex >= 0 ? restoredIndex : 0,
  };
}

export function cycleRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === 'off') return 'all';
  if (mode === 'all') return 'one';
  return 'off';
}

export function advanceQueue(
  state: QueueState,
  direction: 'next' | 'prev',
  options?: { manual?: boolean }
): { state: QueueState; track: Track | null; ended: boolean } {
  if (state.queue.length === 0 || state.currentIndex < 0) {
    return { state, track: null, ended: true };
  }

  if (direction === 'next') {
    if (state.repeat === 'one' && !options?.manual) {
      return {
        state,
        track: state.queue[state.currentIndex],
        ended: false,
      };
    }

    if (state.currentIndex + 1 < state.queue.length) {
      const nextIndex = state.currentIndex + 1;
      return {
        state: { ...state, currentIndex: nextIndex },
        track: state.queue[nextIndex],
        ended: false,
      };
    }

    if (state.repeat === 'all') {
      return {
        state: { ...state, currentIndex: 0 },
        track: state.queue[0],
        ended: false,
      };
    }

    return { state, track: null, ended: true };
  }

  // Previous
  if (state.currentIndex - 1 >= 0) {
    const prevIndex = state.currentIndex - 1;
    return {
      state: { ...state, currentIndex: prevIndex },
      track: state.queue[prevIndex],
      ended: false,
    };
  }

  if (state.repeat === 'all') {
    const lastIndex = state.queue.length - 1;
    return {
      state: { ...state, currentIndex: lastIndex },
      track: state.queue[lastIndex],
      ended: false,
    };
  }

  return {
    state: { ...state, currentIndex: 0 },
    track: state.queue[0],
    ended: false,
  };
}

/**
 * Appends YouTube Music Up-Next radio continuation tracks while respecting
 * hideVideoSongs and deduplicating against tracks already in the queue.
 */
export function appendRadioContinuation(
  state: QueueState,
  candidates: Track[],
  settings: Pick<PlayerSettings, 'hideVideoSongs'>,
  limit = 15
): QueueState {
  const existingIds = new Set(state.queue.map((t) => t.videoId));
  const filtered = filterTracksByPreferences(candidates, settings)
    .filter((t) => !existingIds.has(t.videoId))
    .slice(0, limit);

  if (filtered.length === 0) return state;

  return {
    ...state,
    queue: [...state.queue, ...filtered],
    originalQueue: [...state.originalQueue, ...filtered],
  };
}
