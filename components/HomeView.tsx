'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { motion } from 'motion/react';
import {
  Disc3,
  Flame,
  ListMusic,
  Play,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import { useMusic } from './MusicProvider';
import { ArtworkImage } from './ArtworkImage';
import { TrackContextMenu } from './TrackContextMenu';
import {
  EditorialFeatureCarousel,
  EssentialsAndAlbumsSection,
  TopPicksCollageSection,
  ViralHitsCompactSection,
} from './HomeEditorialSections';
import {
  HomeShelvesSkeleton,
  QuickPicksSkeleton,
  TrendingGenreSkeleton,
} from './Skeletons';
import {
  buildForgottenFavorites,
  buildKeepListening,
  buildQuickPicks,
  buildSpeedDial,
} from '@/lib/metrolist/recommendations';
import type { HomeShelf, HomeShelfItem, Track } from '@/lib/metrolist/types';

const emptySubscribe = () => () => {};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const HOME_MOOD_CHIPS = [
  { id: 'all', label: 'All', query: '' },
  { id: 'relax', label: 'Relax', query: 'Chill Relax Acoustic Music' },
  { id: 'energize', label: 'Energize', query: 'Upbeat Energy Dance Pop' },
  { id: 'focus', label: 'Focus', query: 'Lofi Study Focus Beats' },
  { id: 'workout', label: 'Workout', query: 'Workout Gym Phonk Hits' },
  { id: 'commute', label: 'Commute', query: 'Feel Good Road Trip Hits' },
  { id: 'sad', label: 'Sad', query: 'Sad Ballad Acoustic Songs' },
];

interface HomePayload {
  shelves: HomeShelf[];
  trendingTracks: Track[];
  region: string;
  source: string;
}

interface GenreFilterSpec {
  id: string;
  label: string;
  query: string;
  accentDark: string;
  accentLight: string;
  glowRgba: string;
}

const TRENDING_GENRES: GenreFilterSpec[] = [
  {
    id: 'pop',
    label: 'Pop',
    query: 'Pop trending hits 2025',
    accentDark: '#FACC15',
    accentLight: '#B45309',
    glowRgba: 'rgba(250, 204, 21, 0.22)',
  },
  {
    id: 'all',
    label: 'All Genres',
    query: '',
    accentDark: '#A8C7FA',
    accentLight: '#1D4ED8',
    glowRgba: 'rgba(96, 165, 250, 0.20)',
  },
  {
    id: 'electronic',
    label: 'Electronic',
    query: 'Electronic dance EDM trending hits',
    accentDark: '#F472B6',
    accentLight: '#BE185D',
    glowRgba: 'rgba(244, 114, 182, 0.21)',
  },
  {
    id: 'reggaeton',
    label: 'Reggaeton',
    query: 'Reggaeton Latin urban top hits',
    accentDark: '#FB923C',
    accentLight: '#C2410C',
    glowRgba: 'rgba(251, 146, 60, 0.21)',
  },
  {
    id: 'dance',
    label: 'Dance',
    query: 'Dance club house hits remix',
    accentDark: '#C084FC',
    accentLight: '#7E22CE',
    glowRgba: 'rgba(192, 132, 252, 0.21)',
  },
  {
    id: 'hiphop',
    label: 'Hip Hop',
    query: 'Hip Hop Rap viral hits',
    accentDark: '#A78BFA',
    accentLight: '#6D28D9',
    glowRgba: 'rgba(167, 139, 250, 0.21)',
  },
  {
    id: 'indie',
    label: 'Indie',
    query: 'Indie alternative chill hits',
    accentDark: '#34D399',
    accentLight: '#047857',
    glowRgba: 'rgba(52, 211, 153, 0.20)',
  },
  {
    id: 'rnb',
    label: 'R&B',
    query: 'R&B Soul smooth top songs',
    accentDark: '#2DD4BF',
    accentLight: '#0F766E',
    glowRgba: 'rgba(45, 212, 191, 0.20)',
  },
];

function chunkTracks(tracks: Track[], size: number): Track[][] {
  const cols: Track[][] = [];
  for (let i = 0; i < tracks.length; i += size) {
    cols.push(tracks.slice(i, i + size));
  }
  return cols;
}

export function HomeView() {
  const {
    history,
    likedTracks,
    playTrack,
    currentTrack,
    isPlaying,
    openDetail,
    settings,
    setActiveTab,
    startRadio,
  } = useMusic();

  const [homeData, setHomeData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [moodTracks, setMoodTracks] = useState<Track[] | null>(null);
  const [moodLoading, setMoodLoading] = useState(false);

  // Trending by genre state (matching IMG_2148 reference)
  const [selectedGenreId, setSelectedGenreId] = useState<string>('pop');
  const [genreTracksMap, setGenreTracksMap] = useState<Record<string, Track[]>>({});
  const [genreLoading, setGenreLoading] = useState(false);
  const genreCacheRef = useRef<Record<string, Track[]>>({});

  const greeting = useSyncExternalStore(
    emptySubscribe,
    getGreeting,
    () => 'Listen Now'
  );

  const genreScopeKey = `${settings.region}:${settings.hideVideoSongs ? 'audio' : 'all'}`;

  const refreshHome = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (settings.ytCookie.trim()) {
        headers['x-yt-cookie'] = settings.ytCookie.trim();
      }
      const res = await fetch(`/api/music/home?gl=${settings.region}`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HomePayload;
      setHomeData(data);
    } catch {
      // keep existing or seeded fallback
    } finally {
      setLoading(false);
    }
  }, [settings.region, settings.ytCookie]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const headers: Record<string, string> = {};
        if (settings.ytCookie.trim()) {
          headers['x-yt-cookie'] = settings.ytCookie.trim();
        }
        const res = await fetch(`/api/music/home?gl=${settings.region}`, {
          headers,
        });
        if (!res.ok) return;
        const data = (await res.json()) as HomePayload;
        if (!cancelled) {
          setHomeData(data);
        }
      } catch {
        // fallback gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [settings.region, settings.ytCookie]);

  // Fetch live tracks for selected Trending Genre chip
  useEffect(() => {
    const genre = TRENDING_GENRES.find((g) => g.id === selectedGenreId);
    if (!genre || genre.id === 'all') return;

    const cacheKey = `${genreScopeKey}:${genre.id}`;
    if (genreCacheRef.current[cacheKey]?.length) return;

    let cancelled = false;
    const run = async () => {
      try {
        const headers: Record<string, string> = {};
        if (settings.ytCookie.trim()) {
          headers['x-yt-cookie'] = settings.ytCookie.trim();
        }
        const regionalQuery =
          genre.id === 'pop' && settings.region === 'ID'
            ? 'Pop Indonesia hits terbaru'
            : genre.query;
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(regionalQuery)}&type=songs&gl=${settings.region}`,
          { headers }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          results?: HomeShelfItem[];
        };
        if (cancelled) return;
        const raw = (data.results || []).filter(
          (i): i is Track & { kind: 'TRACK' } => i.kind === 'TRACK'
        );
        const filtered = settings.hideVideoSongs
          ? raw.filter((t) => t.type !== 'VIDEO')
          : raw;
        if (filtered.length > 0) {
          genreCacheRef.current[cacheKey] = filtered;
          setGenreTracksMap((prev) => ({ ...prev, [cacheKey]: filtered }));
        }
      } catch {
        // fallback gracefully to home trending tracks
      } finally {
        if (!cancelled) setGenreLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedGenreId, genreScopeKey, settings.region, settings.ytCookie, settings.hideVideoSongs]);

  const handleSelectGenre = (genreId: string) => {
    setSelectedGenreId(genreId);
    if (genreId === 'all') {
      setGenreLoading(false);
      return;
    }
    const cacheKey = `${genreScopeKey}:${genreId}`;
    setGenreLoading(!genreCacheRef.current[cacheKey]?.length);
  };

  const handleSelectMood = async (chipId: string, query: string) => {
    setSelectedMood(chipId);
    if (chipId === 'all' || !query) {
      setMoodTracks(null);
      return;
    }
    setMoodLoading(true);
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(query)}&type=songs&gl=${settings.region}`
      );
      if (!res.ok) throw new Error('Mood fetch failed');
      const data = (await res.json()) as { results?: HomeShelfItem[] };
      const tracks = (data.results || [])
        .filter((i): i is Track & { kind: 'TRACK' } => i.kind === 'TRACK')
        .filter((t) => !settings.hideVideoSongs || t.type !== 'VIDEO');
      setMoodTracks(tracks);
    } catch {
      setMoodTracks([]);
    } finally {
      setMoodLoading(false);
    }
  };

  const remoteTracks = useMemo(() => {
    const base = homeData?.trendingTracks || [];
    return settings.hideVideoSongs
      ? base.filter((t) => t.type !== 'VIDEO')
      : base;
  }, [homeData, settings.hideVideoSongs]);

  const speedDial = useMemo(
    () =>
      buildSpeedDial({
        history,
        likedTracks,
        remoteCandidates: remoteTracks,
        settings,
        limit: 8,
      }),
    [history, likedTracks, remoteTracks, settings]
  );

  const quickPicks = useMemo(
    () =>
      buildQuickPicks({
        history,
        likedTracks,
        remoteCandidates: remoteTracks,
        settings,
        limit: 12,
      }),
    [history, likedTracks, remoteTracks, settings]
  );

  const keepListening = useMemo(
    () =>
      buildKeepListening({
        history,
        settings,
        limit: 10,
      }),
    [history, settings]
  );

  const forgottenFavorites = useMemo(
    () =>
      buildForgottenFavorites({
        history,
        likedTracks,
        settings,
        limit: 10,
      }),
    [history, likedTracks, settings]
  );

  const spotlightTrack = useMemo(() => {
    return currentTrack || quickPicks[0] || speedDial[0] || remoteTracks[0] || null;
  }, [currentTrack, quickPicks, speedDial, remoteTracks]);

  const activeGenre = useMemo(
    () => TRENDING_GENRES.find((g) => g.id === selectedGenreId) || TRENDING_GENRES[0],
    [selectedGenreId]
  );

  const activeGenreTracks = useMemo(() => {
    if (selectedGenreId === 'all') {
      return remoteTracks.length > 0 ? remoteTracks : quickPicks;
    }
    const cacheKey = `${genreScopeKey}:${selectedGenreId}`;
    const fetched = genreTracksMap[cacheKey];
    if (fetched && fetched.length > 0) return fetched;
    return remoteTracks.length > 0 ? remoteTracks : quickPicks;
  }, [selectedGenreId, genreScopeKey, genreTracksMap, remoteTracks, quickPicks]);

  const genreColumns = useMemo(
    () => chunkTracks(activeGenreTracks.slice(0, 12), 3),
    [activeGenreTracks]
  );

  const quickPickColumns = useMemo(() => {
    const cols: Track[][] = [];
    for (let i = 0; i < quickPicks.length; i += 4) {
      cols.push(quickPicks.slice(i, i + 4));
    }
    return cols;
  }, [quickPicks]);

  const editorialTrackPool = useMemo(() => {
    const combined = [
      ...activeGenreTracks,
      ...remoteTracks,
      ...quickPicks,
      ...history.map((h) => h.track),
    ];
    const seen = new Set<string>();
    const unique: Track[] = [];
    for (const t of combined) {
      if (!t.videoId || seen.has(t.videoId)) continue;
      seen.add(t.videoId);
      unique.push(t);
    }
    return unique;
  }, [activeGenreTracks, remoteTracks, quickPicks, history]);

  const viralTrackPool = useMemo(() => {
    // Rotate offset so Viral Hits surfaces fresh tracks distinct from top cards
    if (editorialTrackPool.length <= 4) return editorialTrackPool;
    return [...editorialTrackPool.slice(3), ...editorialTrackPool.slice(0, 3)];
  }, [editorialTrackPool]);

  const isDarkTheme = settings.theme === 'dark';

  const handleShelfItemClick = (item: HomeShelfItem, shelf: HomeShelf) => {
    if (item.kind === 'TRACK') {
      const siblingTracks = shelf.items.filter(
        (i): i is Track & { kind: 'TRACK' } => i.kind === 'TRACK'
      );
      playTrack(item, siblingTracks);
      return;
    }
    if (item.kind === 'ALBUM') {
      openDetail({
        kind: 'album',
        id: item.albumId,
        title: item.title,
        thumbnail: item.thumbnail,
      });
      return;
    }
    if (item.kind === 'PLAYLIST') {
      openDetail({
        kind: 'playlist',
        id: item.playlistId,
        title: item.title,
        thumbnail: item.thumbnail,
      });
      return;
    }
    if (item.kind === 'ARTIST') {
      openDetail({
        kind: 'artist',
        id: item.artistId,
        title: item.name,
        thumbnail: item.thumbnail,
      });
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Top Greeting Header & Mood Chips */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight leading-tight truncate">
              {greeting}
            </h1>
            <p className="text-[13px] opacity-60 mt-0.5 truncate">
              Curated mixes & live YouTube Music picks
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              aria-label="Search music"
              className="w-10 h-10 rounded-full metro-surface flex items-center justify-center hover:brightness-110 transition-all"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => void refreshHome()}
              disabled={loading}
              aria-label="Refresh home feed"
              className="w-10 h-10 rounded-full metro-surface flex items-center justify-center hover:brightness-110 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-[17px] h-[17px] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mood Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {HOME_MOOD_CHIPS.map((chip) => {
            const active = selectedMood === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => void handleSelectMood(chip.id, chip.query)}
                className={`px-3.5 h-8 rounded-full text-[13px] font-semibold shrink-0 transition-all ${
                  active
                    ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                    : 'metro-surface text-neutral-700 dark:text-neutral-200 hover:brightness-110'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mood Filtered Results (when a mood chip is selected) */}
      {selectedMood !== 'all' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[20px] font-bold tracking-tight">
              {HOME_MOOD_CHIPS.find((c) => c.id === selectedMood)?.label} Mix
            </h2>
            {moodTracks && moodTracks.length > 0 && (
              <button
                type="button"
                onClick={() => playTrack(moodTracks[0], moodTracks)}
                className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-[12px] font-semibold"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play Mix
              </button>
            )}
          </div>

          {moodLoading ? (
            <QuickPicksSkeleton />
          ) : moodTracks && moodTracks.length > 0 ? (
            <div className="rounded-3xl metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {moodTracks.slice(0, 10).map((track, idx) => {
                const active = currentTrack?.videoId === track.videoId;
                return (
                  <div
                    key={`${track.videoId}-${idx}`}
                    className={`group flex items-center gap-3 px-3 sm:px-4 py-2.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] ${
                      active ? 'bg-[var(--m3-primary)]/[0.10]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => playTrack(track, moodTracks)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-12 h-12 rounded-xl shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[14px] font-semibold truncate ${
                            active ? 'text-[var(--m3-primary)]' : ''
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[12.5px] opacity-60 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </button>
                    <TrackContextMenu track={track} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl metro-surface p-6 text-[13.5px] opacity-65">
              No tracks found for this mood right now.
            </div>
          )}
        </section>
      )}

      {/* Main Personalized Home Sections */}
      {selectedMood === 'all' && (
        <>
          {/* 1. Editorial Featured Spotlight Banner (Distinct visual anchor) */}
          {spotlightTrack && (
            <section
              className="relative overflow-hidden rounded-[28px] metro-surface p-4 sm:p-5"
              style={{
                background: isDarkTheme
                  ? 'linear-gradient(125deg, color-mix(in srgb, var(--m3-primary) 18%, var(--m3-surface)), var(--m3-surface) 68%)'
                  : 'linear-gradient(125deg, color-mix(in srgb, var(--m3-primary) 12%, var(--m3-surface)), var(--m3-surface) 70%)',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <button
                  type="button"
                  onClick={() =>
                    playTrack(
                      spotlightTrack,
                      quickPicks.length > 0 ? quickPicks : remoteTracks
                    )
                  }
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-lg shrink-0 group self-start sm:self-center"
                >
                  <ArtworkImage
                    src={spotlightTrack.thumbnail}
                    alt={spotlightTrack.title}
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white fill-current" />
                  </div>
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--m3-primary)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {currentTrack ? 'Continue Session' : 'Daily Spotlight Mix'}
                  </p>
                  <h2 className="text-[18px] sm:text-[22px] font-bold tracking-tight truncate">
                    {spotlightTrack.title}
                  </h2>
                  <p className="text-[13.5px] opacity-65 truncate">
                    {spotlightTrack.artist}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      playTrack(
                        spotlightTrack,
                        quickPicks.length > 0 ? quickPicks : remoteTracks
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-[13px] font-semibold shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {currentTrack?.videoId === spotlightTrack.videoId && isPlaying
                      ? 'Playing'
                      : 'Play Mix'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void startRadio(spotlightTrack)}
                    className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-full bg-black/[0.06] dark:bg-white/[0.08] text-[13px] font-semibold hover:bg-black/10 dark:hover:bg-white/[0.14] transition-colors"
                  >
                    <Radio className="w-4 h-4" />
                    Radio
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* NEW VARIATION 1: Pilihan Teratas untuk Anda (Tall 3-Circle Artist Collage Cards) */}
          <TopPicksCollageSection
            tracks={editorialTrackPool}
            onPlayMix={(lead, queue) => playTrack(lead, queue)}
          />

          {/* 2. ★ TRENDING BY GENRE (Exact Design Inspired by IMG_2148) */}
          <section
            data-testid="trending-by-genre"
            className="relative -mx-4 sm:mx-0 px-4 sm:px-5 py-5 sm:rounded-[28px] overflow-hidden"
          >
            {/* Dynamic warm ambient radial glow behind tracks */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-all duration-500"
              style={{
                background: isDarkTheme
                  ? `radial-gradient(ellipse 78% 72% at 44% 64%, ${activeGenre.glowRgba}, transparent 74%)`
                  : `radial-gradient(ellipse 78% 72% at 44% 64%, ${activeGenre.glowRgba}, transparent 74%)`,
              }}
            />

            <div className="relative z-10 space-y-4">
              {/* Bold Section Heading */}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[22px] sm:text-[24px] font-bold tracking-tight">
                  Trending by genre
                </h2>
                <span className="text-[11.5px] font-semibold opacity-55 hidden sm:inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  Swipe tracks
                </span>
              </div>

              {/* Outlined Capsule Genre Filter Pills (Active = colored border + colored label) */}
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-0.5">
                {TRENDING_GENRES.map((genre) => {
                  const active = selectedGenreId === genre.id;
                  const activeColor = isDarkTheme
                    ? genre.accentDark
                    : genre.accentLight;
                  return (
                    <button
                      key={genre.id}
                      type="button"
                      data-testid={`genre-chip-${genre.id}`}
                      onClick={() => handleSelectGenre(genre.id)}
                      style={
                        active
                          ? {
                              borderColor: activeColor,
                              color: activeColor,
                            }
                          : undefined
                      }
                      className={`px-4 h-9 rounded-full text-[13.5px] font-bold shrink-0 transition-all border ${
                        active
                          ? 'border-[1.5px] bg-black/[0.04] dark:bg-black/35 shadow-sm'
                          : 'border-black/20 dark:border-white/30 text-neutral-700 dark:text-neutral-200 hover:border-black/45 dark:hover:border-white/55'
                      }`}
                    >
                      {genre.label}
                    </button>
                  );
                })}
              </div>

              {/* Horizontally Swipeable 3-Row Columns with Peeking Next Column */}
              {genreLoading ? (
                <TrendingGenreSkeleton />
              ) : (
                <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mr-4 pr-4 sm:mr-0 sm:pr-0">
                  {genreColumns.map((col, colIdx) => (
                    <div
                      key={`tg-col-${selectedGenreId}-${colIdx}`}
                      className="w-[84vw] max-w-[356px] sm:w-[350px] shrink-0 snap-start space-y-3"
                    >
                      {col.map((track, rowIdx) => {
                        const active = currentTrack?.videoId === track.videoId;
                        return (
                          <div
                            key={`tg-${track.videoId}-${rowIdx}`}
                            className={`group flex items-center gap-3.5 rounded-2xl py-1 pr-1 transition-colors ${
                              active
                                ? 'bg-black/[0.06] dark:bg-white/[0.07] pl-1'
                                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => playTrack(track, activeGenreTracks)}
                              className="flex items-center gap-3.5 flex-1 min-w-0 text-left"
                            >
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-md">
                                <ArtworkImage
                                  src={track.thumbnail}
                                  alt={track.title}
                                  className="w-full h-full"
                                />
                                <div
                                  className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                                    active
                                      ? 'opacity-100'
                                      : 'opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  <Play className="w-4 h-4 text-white fill-current" />
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-[15px] font-bold leading-snug truncate ${
                                    active ? 'text-[var(--m3-primary)]' : ''
                                  }`}
                                >
                                  {track.title}
                                </p>
                                <p className="text-[13.5px] opacity-65 truncate mt-0.5">
                                  {track.artist}
                                </p>
                              </div>
                            </button>

                            <TrackContextMenu track={track} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* NEW VARIATION 2: Dengarkan Sekarang (Header-Above-Poster Top 100 & Editorial Feature Cards) */}
          <EditorialFeatureCarousel
            tracks={editorialTrackPool}
            shelves={homeData?.shelves || []}
            region={settings.region}
            onPlayTrack={(track, queue) => playTrack(track, queue)}
            onOpenShelfItem={handleShelfItemClick}
          />

          {/* 3. Speed Dial (Compact 2×4 Metrolist Quick Launch Grid) */}
          {speedDial.length > 0 && (
            <section className="space-y-3 cv-auto">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[19px] font-bold tracking-tight">
                  Speed Dial
                </h2>
                <button
                  type="button"
                  onClick={() => playTrack(speedDial[0], speedDial)}
                  className="text-[12.5px] font-semibold text-[var(--m3-primary)] hover:underline"
                >
                  Play all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {speedDial.map((track) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <button
                      key={`sd-${track.videoId}`}
                      type="button"
                      onClick={() => playTrack(track, speedDial)}
                      className={`group relative overflow-hidden rounded-2xl aspect-[16/10] sm:aspect-square text-left transition-transform active:scale-[0.98] ${
                        active ? 'ring-2 ring-[var(--m3-primary)]' : ''
                      }`}
                    >
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                        <p className="text-[13px] font-bold text-white leading-tight truncate">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-white/75 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* NEW VARIATION 3: Album & Essentials Pilihan (Split-Top Essentials + Large Square Showcase) */}
          <EssentialsAndAlbumsSection
            tracks={editorialTrackPool}
            shelves={homeData?.shelves || []}
            onPlayTrack={(track, queue) => playTrack(track, queue)}
            onOpenShelfItem={handleShelfItemClick}
          />

          {/* NEW VARIATION 4: + Tambahkan Hit Viral Ini > (4-Row Swipeable Hairline Columns) */}
          <ViralHitsCompactSection
            tracks={viralTrackPool}
            currentVideoId={currentTrack?.videoId}
            onPlayTrack={(track, queue) => playTrack(track, queue)}
          />

          {/* 4. Quick Picks (Metrolist Multi-Column 4-Row Grouped Cards) */}
          <section className="space-y-3 cv-auto">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-55">
                  Start radio from a song
                </p>
                <h2 className="text-[19px] font-bold tracking-tight">
                  Quick Picks
                </h2>
              </div>
              {quickPicks.length > 0 && (
                <button
                  type="button"
                  onClick={() => playTrack(quickPicks[0], quickPicks)}
                  className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full metro-surface text-[12px] font-semibold hover:brightness-110 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-[var(--m3-primary)]" />
                  Play all
                </button>
              )}
            </div>

            {loading && quickPicks.length === 0 ? (
              <QuickPicksSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {quickPickColumns.map((col, colIdx) => (
                  <div
                    key={`qp-col-${colIdx}`}
                    className="rounded-3xl metro-surface p-2 space-y-0.5"
                  >
                    {col.map((track) => {
                      const active = currentTrack?.videoId === track.videoId;
                      return (
                        <div
                          key={`qp-${track.videoId}`}
                          className={`group flex items-center gap-3 p-2 rounded-2xl transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                            active ? 'bg-[var(--m3-primary)]/[0.12]' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => playTrack(track, quickPicks)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                              <ArtworkImage
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-full h-full"
                              />
                              <div
                                className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                                  active
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <Play className="w-4 h-4 text-white fill-current" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[13.5px] font-semibold truncate ${
                                  active ? 'text-[var(--m3-primary)]' : ''
                                }`}
                              >
                                {track.title}
                              </p>
                              <p className="text-[12px] opacity-60 truncate">
                                {track.artist}
                              </p>
                            </div>
                          </button>
                          <TrackContextMenu track={track} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Keep Listening (Editorial Feature Cards) */}
          {keepListening.length > 0 && (
            <section className="space-y-3 cv-auto">
              <h2 className="text-[19px] font-bold tracking-tight">
                Keep Listening
              </h2>
              <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
                {keepListening.map((track) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={`kl-${track.videoId}`}
                      className="w-40 sm:w-44 shrink-0 group rounded-2xl metro-surface p-2.5 transition-all hover:brightness-105"
                    >
                      <button
                        type="button"
                        onClick={() => playTrack(track, keepListening)}
                        className="w-full text-left"
                      >
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2.5 shadow-sm">
                          <ArtworkImage
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                          />
                          <span
                            className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] flex items-center justify-center shadow-lg transition-all ${
                              active
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </span>
                        </div>
                        <p
                          className={`text-[13.5px] font-semibold truncate ${
                            active ? 'text-[var(--m3-primary)]' : ''
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[12px] opacity-60 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 6. Forgotten Favorites (Distinct Horizontal 2-Row Compact Cards) */}
          {forgottenFavorites.length > 0 && (
            <section className="space-y-3 cv-auto">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[19px] font-bold tracking-tight">
                  Forgotten Favorites
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    playTrack(forgottenFavorites[0], forgottenFavorites)
                  }
                  className="text-[12.5px] font-semibold text-[var(--m3-primary)] hover:underline"
                >
                  Shuffle back
                </button>
              </div>
              <div className="grid grid-flow-col grid-rows-2 auto-cols-[78vw] sm:auto-cols-[290px] gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {forgottenFavorites.map((track) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={`ff-${track.videoId}`}
                      className={`group flex items-center gap-3 p-2.5 rounded-2xl metro-surface transition-all hover:brightness-105 ${
                        active ? 'ring-1 ring-[var(--m3-primary)]' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playTrack(track, forgottenFavorites)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <ArtworkImage
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-12 rounded-xl shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-[13.5px] font-semibold truncate ${
                              active ? 'text-[var(--m3-primary)]' : ''
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-[12px] opacity-60 truncate">
                            {track.artist}
                          </p>
                        </div>
                      </button>
                      <TrackContextMenu track={track} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 7. Live YouTube Music Shelves (Varied Visual Rhythm: Artists = Circles, Albums/Playlists = Showcase) */}
          {loading && !homeData ? (
            <HomeShelvesSkeleton />
          ) : (
            homeData?.shelves.map((shelf) => {
              if (!shelf.items.length) return null;
              const isArtistShelf = shelf.items.every((i) => i.kind === 'ARTIST');

              return (
                <motion.section
                  key={shelf.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 cv-auto"
                >
                  <h2 className="text-[19px] font-bold tracking-tight">
                    {shelf.title}
                  </h2>

                  <div className="flex gap-3.5 overflow-x-auto no-scrollbar pb-2">
                    {shelf.items.slice(0, 12).map((item, idx) => {
                      const key =
                        item.kind === 'TRACK'
                          ? `${shelf.id}-${item.videoId}-${idx}`
                          : item.kind === 'ALBUM'
                            ? `${shelf.id}-${item.albumId}-${idx}`
                            : item.kind === 'PLAYLIST'
                              ? `${shelf.id}-${item.playlistId}-${idx}`
                              : `${shelf.id}-${item.artistId}-${idx}`;

                      const title =
                        item.kind === 'ARTIST' ? item.name : item.title;
                      const subtitle =
                        item.kind === 'ARTIST'
                          ? 'Artist'
                          : item.kind === 'ALBUM'
                            ? item.artist
                            : item.kind === 'PLAYLIST'
                              ? item.artist
                              : item.artist;

                      if (isArtistShelf || item.kind === 'ARTIST') {
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleShelfItemClick(item, shelf)}
                            className="w-32 sm:w-36 shrink-0 group text-center space-y-2.5 p-2 rounded-2xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                          >
                            <ArtworkImage
                              src={item.thumbnail}
                              alt={title}
                              className="w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-full shadow-md group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold truncate">
                                {title}
                              </p>
                              <p className="text-[11.5px] opacity-55 flex items-center justify-center gap-1 mt-0.5">
                                <User className="w-3 h-3" /> Artist
                              </p>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleShelfItemClick(item, shelf)}
                          className="w-40 sm:w-44 shrink-0 group text-left space-y-2"
                        >
                          <div className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-md">
                            <ArtworkImage
                              src={item.thumbnail}
                              alt={title}
                              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                            />
                            <span className="absolute right-2.5 bottom-2.5 w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </span>
                          </div>
                          <div className="min-w-0 px-0.5">
                            <p className="text-[13.5px] font-semibold truncate">
                              {title}
                            </p>
                            <p className="text-[12px] opacity-60 truncate flex items-center gap-1 mt-0.5">
                              {item.kind === 'ALBUM' && (
                                <Disc3 className="w-3 h-3 shrink-0" />
                              )}
                              {item.kind === 'PLAYLIST' && (
                                <ListMusic className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">{subtitle}</span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
