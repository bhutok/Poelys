import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoTopMixes,
  clampEqBand,
  computeListeningStats,
  computeTotalDurationSec,
  EQUALIZER_PRESETS,
  filterHistoryByPeriod,
  filterTracksByQuery,
  formatLongDuration,
  searchLocalLibrary,
  sortLibraryTracks,
  sortTracksList,
} from './statsEngine';
import type { PlayEvent, Track, UserPlaylist } from './types';

const makeTrack = (id: string, title: string, artist: string, duration = 200): Track => ({
  videoId: id,
  title,
  artist,
  artists: [{ artistId: null, name: artist }],
  duration,
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  type: 'SONG',
});

test('filterHistoryByPeriod filters week, month, year, and all windows accurately', () => {
  const now = new Date('2026-11-21T22:00:00Z').getTime();
  const day = 86_400_000;
  const history: PlayEvent[] = [
    { track: makeTrack('a', 'Alpha', 'Artist A'), playCount: 4, lastPlayedAt: now - 2 * day, firstPlayedAt: now - 5 * day },
    { track: makeTrack('b', 'Beta', 'Artist B'), playCount: 3, lastPlayedAt: now - 15 * day, firstPlayedAt: now - 20 * day },
    { track: makeTrack('c', 'Gamma', 'Artist C'), playCount: 6, lastPlayedAt: now - 90 * day, firstPlayedAt: now - 120 * day },
    { track: makeTrack('d', 'Delta', 'Artist D'), playCount: 10, lastPlayedAt: now - 400 * day, firstPlayedAt: now - 450 * day },
  ];

  assert.equal(filterHistoryByPeriod(history, 'week', now).length, 1);
  assert.equal(filterHistoryByPeriod(history, 'month', now).length, 2);
  assert.equal(filterHistoryByPeriod(history, 'year', now).length, 3);
  assert.equal(filterHistoryByPeriod(history, 'all', now).length, 4);
});

test('computeListeningStats aggregates plays, minutes, artist shares, and top songs', () => {
  const now = new Date('2026-11-21T22:00:00').getTime();
  const history: PlayEvent[] = [
    { track: makeTrack('1', 'Starboy', 'The Weeknd', 240), playCount: 6, lastPlayedAt: now, firstPlayedAt: now },
    { track: makeTrack('2', 'Blinding Lights', 'The Weeknd', 200), playCount: 4, lastPlayedAt: now, firstPlayedAt: now },
    { track: makeTrack('3', 'Get Lucky', 'Daft Punk', 240), playCount: 5, lastPlayedAt: now, firstPlayedAt: now },
  ];

  const stats = computeListeningStats({
    history,
    likedCount: 2,
    playlistsCount: 1,
    period: 'all',
    nowMs: now,
  });

  assert.equal(stats.totalPlays, 15);
  assert.equal(stats.uniqueTracks, 3);
  assert.equal(stats.uniqueArtists, 2);
  assert.equal(stats.topSongs[0].track.title, 'Starboy');
  assert.equal(stats.topArtists[0].name, 'The Weeknd');
  assert.equal(stats.topArtists[0].playCount, 10);
  assert.equal(stats.topArtists[0].sharePct, 67);
  assert.equal(stats.topArtists[1].sharePct, 33);
  assert.ok(stats.totalMinutes > 40);
  assert.equal(stats.listeningPersona.title, 'Midnight Audiophile');
});

test('searchLocalLibrary deduplicates tracks across liked, history, and playlists and matches tags', () => {
  const t1 = makeTrack('v1', 'Midnight City', 'M83', 243);
  const t2 = makeTrack('v2', 'Instant Crush', 'Daft Punk', 337);
  const playlists: UserPlaylist[] = [
    {
      id: 'pl-1',
      name: 'Night Drive',
      description: 'Synthwave classics',
      tags: ['Synth', 'Night'],
      createdAt: 1,
      updatedAt: 2,
      tracks: [t1, t2],
    },
  ];
  const res = searchLocalLibrary({
    query: 'night',
    likedTracks: [t1],
    history: [{ track: t1, playCount: 3, lastPlayedAt: 100, firstPlayedAt: 50 }],
    playlists,
  });

  assert.equal(res.tracks.length, 1);
  assert.equal(res.tracks[0].videoId, 'v1');
  assert.equal(res.playlists.length, 1);
  assert.equal(res.playlists[0].id, 'pl-1');
});

test('sortTracksList sorts by title and duration without mutating original array', () => {
  const input = [
    makeTrack('1', 'Zebra', 'A', 120),
    makeTrack('2', 'Alpha', 'B', 310),
    makeTrack('3', 'Middle', 'C', 210),
  ];
  const byTitle = sortTracksList(input, 'title');
  assert.deepEqual(
    byTitle.map((t) => t.title),
    ['Alpha', 'Middle', 'Zebra']
  );
  const byDur = sortTracksList(input, 'duration');
  assert.deepEqual(
    byDur.map((t) => t.videoId),
    ['2', '3', '1']
  );
  // Original untouched
  assert.equal(input[0].title, 'Zebra');
});

test('sortLibraryTracks supports artist and mostPlayed sorting and filterTracksByQuery matches cleanly', () => {
  const t1 = makeTrack('1', 'Starboy', 'The Weeknd', 230);
  const t2 = makeTrack('2', 'Get Lucky', 'Daft Punk', 248);
  const t3 = makeTrack('3', 'Attention', 'Charlie Puth', 211);
  const history: PlayEvent[] = [
    { track: t3, playCount: 12, lastPlayedAt: 1000, firstPlayedAt: 500 },
    { track: t1, playCount: 4, lastPlayedAt: 1000, firstPlayedAt: 500 },
  ];

  const byArtist = sortLibraryTracks([t1, t2, t3], 'artist', history);
  assert.deepEqual(byArtist.map((t) => t.artist), ['Charlie Puth', 'Daft Punk', 'The Weeknd']);

  const byPlayed = sortLibraryTracks([t1, t2, t3], 'mostPlayed', history);
  assert.equal(byPlayed[0].videoId, '3');

  const filtered = filterTracksByQuery([t1, t2, t3], 'daft');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].videoId, '2');
});

test('buildAutoTopMixes creates My Top Mix, On Repeat, and Rediscover mixes from history & liked', () => {
  const now = new Date('2026-11-21T12:00:00Z').getTime();
  const day = 86_400_000;
  const t1 = makeTrack('1', 'Starboy', 'The Weeknd', 230);
  const t2 = makeTrack('2', 'Midnight City', 'M83', 243);
  const t3 = makeTrack('3', 'Get Lucky', 'Daft Punk', 248);

  const history: PlayEvent[] = [
    { track: t1, playCount: 9, lastPlayedAt: now - day, firstPlayedAt: now - 10 * day },
    { track: t2, playCount: 5, lastPlayedAt: now - 8 * day, firstPlayedAt: now - 20 * day },
  ];
  const mixes = buildAutoTopMixes(history, [t3], now);
  assert.equal(mixes.length, 3);
  assert.equal(mixes[0].id, 'my-top-mix');
  assert.equal(mixes[0].tracks.length, 3);
  assert.equal(mixes[1].id, 'most-replayed');
  assert.equal(mixes[2].id, 'rediscover');
  assert.equal(mixes[2].tracks[0].videoId, '2');
});

test('computeTotalDurationSec, formatLongDuration, and EQ helpers work accurately', () => {
  const tracks = [makeTrack('1', 'A', 'X', 1800), makeTrack('2', 'B', 'Y', 2400)];
  const totalSec = computeTotalDurationSec(tracks);
  assert.equal(totalSec, 4200);
  assert.equal(formatLongDuration(totalSec), '1 hr 10 min');
  assert.equal(formatLongDuration(900), '15 min');
  assert.equal(clampEqBand(24), 12);
  assert.equal(clampEqBand(-18), -12);
  assert.equal(EQUALIZER_PRESETS.BASS_BOOST.bands.length, 5);
});

