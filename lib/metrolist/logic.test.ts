import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuickPicks,
  buildForgottenFavorites,
  buildKeepListening,
  filterTracksByPreferences,
} from './recommendations';
import {
  createQueueState,
  playTrackInQueue,
  insertPlayNext,
  appendToQueue,
  toggleShuffleQueue,
  cycleRepeatMode,
  advanceQueue,
  appendRadioContinuation,
  getCurrentTrack,
} from './queue';
import {
  parseLrcLyrics,
  findActiveLyricIndex,
  formatDuration,
} from './lyrics';
import { resolveMetrolistTheme } from './theme';
import {
  buildMediaSessionPosition,
  computeElapsedWithDrift,
  createSilentWavDataUri,
  resolveBackgroundPopupStrategy,
  shouldAutoRecoverBackgroundPlayback,
} from './background';
import type { PlayEvent, Track } from './types';

function makeTrack(
  id: string,
  type: 'SONG' | 'VIDEO' = 'SONG',
  title = `Track ${id}`
): Track {
  return {
    videoId: id,
    title,
    artist: `Artist ${id}`,
    artists: [{ artistId: null, name: `Artist ${id}` }],
    album: null,
    duration: 210,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    type,
  };
}

test('Metrolist PR #4520 invariant: hideVideoSongs filters BEFORE slicing Quick Picks', () => {
  const now = 1_700_000_000_000;
  const history: PlayEvent[] = [
    { track: makeTrack('v1', 'VIDEO'), playCount: 20, lastPlayedAt: now - 1000, firstPlayedAt: now - 10000 },
    { track: makeTrack('v2', 'VIDEO'), playCount: 18, lastPlayedAt: now - 2000, firstPlayedAt: now - 10000 },
    { track: makeTrack('s1', 'SONG'), playCount: 15, lastPlayedAt: now - 3000, firstPlayedAt: now - 10000 },
    { track: makeTrack('s2', 'SONG'), playCount: 14, lastPlayedAt: now - 4000, firstPlayedAt: now - 10000 },
  ];
  const remoteCandidates = [
    makeTrack('s3', 'SONG'),
    makeTrack('s4', 'SONG'),
    makeTrack('s5', 'SONG'),
  ];

  const picks = buildQuickPicks({
    history,
    likedTracks: [],
    remoteCandidates,
    settings: { hideVideoSongs: true },
    limit: 4,
    nowMs: now,
  });

  // Should backfill with s3 & s4 instead of dropping from 4 to 2!
  assert.equal(picks.length, 4);
  assert.ok(picks.every((t) => t.type === 'SONG'));
  assert.deepEqual(
    picks.map((t) => t.videoId),
    ['s1', 's2', 's3', 's4']
  );
});

test('filterTracksByPreferences deduplicates videoIds and preserves SONG when duplicate exists', () => {
  const tracks = [
    makeTrack('a1', 'SONG'),
    makeTrack('a1', 'SONG'),
    makeTrack('v1', 'VIDEO'),
  ];
  const filtered = filterTracksByPreferences(tracks, { hideVideoSongs: true });
  assert.deepEqual(
    filtered.map((t) => t.videoId),
    ['a1']
  );
});

test('buildKeepListening returns recently played items ordered by recency & frequency', () => {
  const now = 1_700_000_000_000;
  const day = 24 * 3600 * 1000;
  const history: PlayEvent[] = [
    { track: makeTrack('old', 'SONG'), playCount: 10, lastPlayedAt: now - 40 * day, firstPlayedAt: now - 60 * day },
    { track: makeTrack('recent1', 'SONG'), playCount: 3, lastPlayedAt: now - 1000, firstPlayedAt: now - day },
    { track: makeTrack('recent2', 'SONG'), playCount: 1, lastPlayedAt: now - 5 * day, firstPlayedAt: now - 5 * day },
  ];

  const keep = buildKeepListening({
    history,
    settings: { hideVideoSongs: false },
    limit: 5,
    nowMs: now,
  });

  assert.deepEqual(
    keep.map((t) => t.videoId),
    ['recent1', 'recent2']
  );
});

test('buildForgottenFavorites surfaces older high-affinity tracks outside recent window', () => {
  const now = 1_700_000_000_000;
  const day = 24 * 3600 * 1000;
  const history: PlayEvent[] = [
    { track: makeTrack('fresh', 'SONG'), playCount: 8, lastPlayedAt: now - 1000, firstPlayedAt: now - day },
    { track: makeTrack('forgotten1', 'SONG'), playCount: 6, lastPlayedAt: now - 14 * day, firstPlayedAt: now - 40 * day },
    { track: makeTrack('oneoff', 'SONG'), playCount: 1, lastPlayedAt: now - 20 * day, firstPlayedAt: now - 20 * day },
  ];

  const forgotten = buildForgottenFavorites({
    history,
    likedTracks: [],
    settings: { hideVideoSongs: false },
    cooldownDays: 7,
    recentSkipCount: 1,
    limit: 5,
    nowMs: now,
  });

  assert.deepEqual(
    forgotten.map((t) => t.videoId),
    ['forgotten1']
  );
});

test('QueueEngine supports playNext, appendToQueue, shuffle pinning active track, and restore', () => {
  const t1 = makeTrack('t1');
  const t2 = makeTrack('t2');
  const t3 = makeTrack('t3');
  const t4 = makeTrack('t4');

  let state = createQueueState();
  state = playTrackInQueue(state, t2, [t1, t2, t3]);
  assert.equal(getCurrentTrack(state)?.videoId, 't2');
  assert.equal(state.currentIndex, 1);

  // Play next inserts right after t2
  state = insertPlayNext(state, t4);
  assert.deepEqual(
    state.queue.map((t) => t.videoId),
    ['t1', 't2', 't4', 't3']
  );

  // Toggle shuffle keeps active track (t2) at index 0
  state = toggleShuffleQueue(state, () => 0.25);
  assert.equal(state.shuffle, true);
  assert.equal(state.currentIndex, 0);
  assert.equal(getCurrentTrack(state)?.videoId, 't2');
  assert.equal(state.queue.length, 4);

  // Untoggle shuffle restores originalQueue and points currentIndex back to t2
  state = toggleShuffleQueue(state);
  assert.equal(state.shuffle, false);
  assert.equal(getCurrentTrack(state)?.videoId, 't2');
  assert.deepEqual(
    state.queue.map((t) => t.videoId),
    ['t1', 't2', 't3', 't4']
  );
});

test('QueueEngine advanceQueue handles repeat off / all / one and appendRadioContinuation deduplicates', () => {
  const t1 = makeTrack('t1');
  const t2 = makeTrack('t2');
  const v3 = makeTrack('v3', 'VIDEO');
  const s4 = makeTrack('s4', 'SONG');

  let state = playTrackInQueue(createQueueState(), t2, [t1, t2]);

  // Repeat off at end -> ended: true
  const endOff = advanceQueue(state, 'next');
  assert.equal(endOff.ended, true);
  assert.equal(endOff.track, null);

  // Repeat all at end -> wraps to index 0
  state = { ...state, repeat: cycleRepeatMode(state.repeat) }; // 'all'
  assert.equal(state.repeat, 'all');
  const wrapAll = advanceQueue(state, 'next');
  assert.equal(wrapAll.ended, false);
  assert.equal(wrapAll.track?.videoId, 't1');

  // Repeat one -> stays on t2 on automatic advance, moves on manual skip
  state = { ...state, repeat: cycleRepeatMode(state.repeat) }; // 'one'
  assert.equal(state.repeat, 'one');
  const autoOne = advanceQueue(state, 'next');
  assert.equal(autoOne.track?.videoId, 't2');

  // Append radio continuation filters video songs & deduplicates t2
  state = appendToQueue(state, s4);
  state = appendRadioContinuation(state, [t2, v3, s4, makeTrack('s5')], {
    hideVideoSongs: true,
  });
  assert.deepEqual(
    state.queue.map((t) => t.videoId),
    ['t1', 't2', 's4', 's5']
  );
});

test('Synced LRC lyrics parser & binary-search active index work accurately', () => {
  const lrc = `
[00:12.50] First line
[00:25.00] Second line
[01:02.750] Third line
  `;
  const lines = parseLrcLyrics(lrc);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].timeSec, 12.5);
  assert.equal(lines[2].timeSec, 62.75);

  assert.equal(findActiveLyricIndex(lines, 5), -1);
  assert.equal(findActiveLyricIndex(lines, 13), 0);
  assert.equal(findActiveLyricIndex(lines, 25), 1);
  assert.equal(findActiveLyricIndex(lines, 90), 2);
  assert.equal(formatDuration(200), '3:20');
  assert.equal(formatDuration(3665), '1:01:05');
});

test('Metrolist theme resolver supports Pure Black AMOLED, Light mode, and Dynamic Color', () => {
  const amoled = resolveMetrolistTheme({
    theme: 'dark',
    pureBlack: true,
    dynamicColor: false,
    accentPreset: 'metrolist',
  });
  assert.equal(amoled.tokens.bg, '#000000');
  assert.equal(amoled.tokens.primary, '#A8C7FA');
  assert.equal(amoled.activePreset, 'metrolist');

  const light = resolveMetrolistTheme({
    theme: 'light',
    pureBlack: true,
    dynamicColor: false,
    accentPreset: 'emerald',
  });
  assert.equal(light.tokens.bg, '#F7F8FC');
  assert.equal(light.activePreset, 'emerald');

  const dynamicTrackA = resolveMetrolistTheme(
    {
      theme: 'dark',
      pureBlack: false,
      dynamicColor: true,
      accentPreset: 'metrolist',
    },
    { videoId: 'fHI8X4OXluQ', title: 'Blinding Lights' }
  );
  const dynamicTrackB = resolveMetrolistTheme(
    {
      theme: 'dark',
      pureBlack: false,
      dynamicColor: true,
      accentPreset: 'metrolist',
    },
    { videoId: 'fHI8X4OXluQ', title: 'Blinding Lights' }
  );
  assert.equal(dynamicTrackA.activePreset, dynamicTrackB.activePreset);
  assert.equal(dynamicTrackA.tokens.bg, '#111216');
});

test('Background popup strategy cascade, visibility recovery, drift correction & Media Session clamping', () => {
  assert.equal(
    resolveBackgroundPopupStrategy({ hasDocumentPiP: true, hasVideoPiP: true, inIframe: false }),
    'document-pip'
  );
  assert.equal(
    resolveBackgroundPopupStrategy({ hasDocumentPiP: true, hasVideoPiP: true, inIframe: true }),
    'video-pip'
  );
  assert.equal(
    resolveBackgroundPopupStrategy({ hasDocumentPiP: false, hasVideoPiP: true, inIframe: false }),
    'video-pip'
  );
  assert.equal(
    resolveBackgroundPopupStrategy({ hasDocumentPiP: false, hasVideoPiP: false, inIframe: true }),
    'floating-overlay'
  );

  // Auto-recovery triggers when involuntarily paused while hidden OR during active popup/PiP
  assert.equal(
    shouldAutoRecoverBackgroundPlayback({
      backgroundPlayEnabled: true,
      intendedPlaying: true,
      userPaused: false,
      visibilityHidden: true,
      ytState: 'paused',
    }),
    true
  );
  assert.equal(
    shouldAutoRecoverBackgroundPlayback({
      backgroundPlayEnabled: true,
      intendedPlaying: true,
      userPaused: false,
      visibilityHidden: false,
      popupActive: true,
      ytState: 'paused',
    }),
    true
  );
  assert.equal(
    shouldAutoRecoverBackgroundPlayback({
      backgroundPlayEnabled: true,
      intendedPlaying: true,
      userPaused: true,
      visibilityHidden: true,
      popupActive: true,
      ytState: 'paused',
    }),
    false
  );
  assert.equal(
    shouldAutoRecoverBackgroundPlayback({
      backgroundPlayEnabled: false,
      intendedPlaying: true,
      userPaused: false,
      visibilityHidden: true,
      ytState: 'paused',
    }),
    false
  );

  // Wall-clock drift correction across a 2-second throttled background tick at 1.25x
  const drifted = computeElapsedWithDrift(10, 1000, 3000, 1.25, 200);
  assert.equal(drifted.reachedEnd, false);
  assert.equal(drifted.nextTime, 12.5);

  const ended = computeElapsedWithDrift(199, 1000, 3000, 1, 200);
  assert.equal(ended.reachedEnd, true);
  assert.equal(ended.nextTime, 0);

  // Media Session position clamping prevents RangeError
  assert.equal(buildMediaSessionPosition(10, 0, 1), null);
  assert.deepEqual(buildMediaSessionPosition(250, 200, 1), {
    duration: 200,
    playbackRate: 1,
    position: 200,
  });

  // Silent WAV keep-alive data URI starts cleanly
  const wav = createSilentWavDataUri();
  assert.ok(wav.startsWith('data:audio/wav;base64,'));
  assert.ok(wav.length > 100);
});

