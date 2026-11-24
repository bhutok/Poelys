'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpDown,
  Clock,
  Disc3,
  Film,
  FolderSearch,
  Globe,
  ListMusic,
  Music2,
  Play,
  Radio,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useMusic } from './MusicProvider';
import { ArtworkImage } from './ArtworkImage';
import { TrackContextMenu } from './TrackContextMenu';
import { SearchResultsSkeleton } from './Skeletons';
import {
  searchLocalLibrary,
  sortTracksList,
  type TrackSortMode,
} from '@/lib/metrolist/statsEngine';
import type {
  AlbumSummary,
  ArtistSummary,
  PlaylistSummary,
  Track,
} from '@/lib/metrolist/types';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type SearchTab = 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';
type SearchScope = 'online' | 'local';

interface SearchResponse {
  tracks: Track[];
  albums: AlbumSummary[];
  artists: ArtistSummary[];
  playlists: PlaylistSummary[];
}

interface VibeCardSpec {
  id: string;
  label: string;
  query: string;
  image: string;
  borderColor: string;
  fallbackGradient: string;
  heightClass: string;
  compactHorizontal?: boolean;
}

const LEFT_VIBES: VibeCardSpec[] = [
  {
    id: 'hiphop',
    label: 'Hip Hop & Rap',
    query: 'Hip Hop Rap Hits',
    image: '/vibes/hiphop.jpg',
    borderColor: '#9E7BFF',
    fallbackGradient: 'radial-gradient(circle at 70% 80%, #9E7BFF55, #1D1D21 72%)',
    heightClass: 'h-[178px] sm:h-[218px]',
  },
  {
    id: 'pop',
    label: 'Pop',
    query: 'Pop Top Hits',
    image: '/vibes/pop.jpg',
    borderColor: '#F6D04D',
    fallbackGradient: 'radial-gradient(circle at 55% 75%, #F6D04D55, #1D1D21 72%)',
    heightClass: 'h-[282px] sm:h-[326px]',
  },
  {
    id: 'chill',
    label: 'Chill',
    query: 'Chill Lofi Relax Music',
    image: '/vibes/chill.jpg',
    borderColor: '#36B5B0',
    fallbackGradient: 'radial-gradient(circle at 82% 55%, #36B5B055, #1D1D21 72%)',
    heightClass: 'h-[104px] sm:h-[124px]',
    compactHorizontal: true,
  },
];

const RIGHT_VIBES: VibeCardSpec[] = [
  {
    id: 'electronic',
    label: 'Electronic',
    query: 'Electronic Dance EDM Hits',
    image: '/vibes/electronic.jpg',
    borderColor: '#F25C9B',
    fallbackGradient: 'radial-gradient(circle at 60% 70%, #F25C9B55, #1D1D21 72%)',
    heightClass: 'h-[272px] sm:h-[314px]',
  },
  {
    id: 'rnb',
    label: 'R&B',
    query: 'R&B Soul Smooth Hits',
    image: '/vibes/rnb.jpg',
    borderColor: '#36B5B0',
    fallbackGradient: 'radial-gradient(circle at 82% 55%, #36B5B055, #1D1D21 72%)',
    heightClass: 'h-[104px] sm:h-[124px]',
    compactHorizontal: true,
  },
  {
    id: 'party',
    label: 'Party',
    query: 'Party Club Dance Anthems',
    image: '/vibes/party.jpg',
    borderColor: '#F08A5D',
    fallbackGradient: 'radial-gradient(circle at 55% 80%, #F08A5D55, #1D1D21 72%)',
    heightClass: 'h-[192px] sm:h-[230px]',
  },
];

const EXTRA_MOODS = [
  { label: 'Indonesian Pop', query: 'Pop Indonesia Terbaru', accent: '#F59E0B' },
  { label: 'K-Pop & J-Pop', query: 'K-Pop J-Pop Viral Hits', accent: '#EC4899' },
  { label: 'Indie Acoustic', query: 'Indie Acoustic Folk Chill', accent: '#10B981' },
  { label: 'Workout Boost', query: 'Workout Gym Phonk EDM', accent: '#EF4444' },
  { label: 'Late Night Drive', query: 'Synthwave Night Drive Music', accent: '#8B5CF6' },
  { label: 'Focus & Study', query: 'Lo-Fi Study Beats Instrumental', accent: '#06B6D4' },
];

const MOOD_TILE_SHAPES = [
  'rounded-tl-[22px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[22px]',
  'rounded-tl-[12px] rounded-tr-[22px] rounded-bl-[22px] rounded-br-[12px]',
  'rounded-tl-[20px] rounded-tr-[20px] rounded-bl-[10px] rounded-br-[20px]',
];

const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'videos', label: 'Videos' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
];

export function SearchView() {
  const {
    playTrack,
    currentTrack,
    openDetail,
    searchHistory,
    addSearchHistory,
    clearSearchHistory,
    settings,
    startRadio,
    likedTracks,
    history,
    playlists,
  } = useMusic();

  const [scope, setScope] = useState<SearchScope>('online');
  const [sortMode, setSortMode] = useState<TrackSortMode>('relevance');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localResults = useMemo(() => {
    if (scope !== 'local') return { tracks: [], playlists: [] };
    return searchLocalLibrary({
      query,
      likedTracks,
      history,
      playlists,
    });
  }, [scope, query, likedTracks, history, playlists]);

  const sortedLocalTracks = useMemo(
    () => sortTracksList(localResults.tracks, sortMode),
    [localResults.tracks, sortMode]
  );

  const sortedOnlineTracks = useMemo(
    () => sortTracksList(results?.tracks ?? [], sortMode),
    [results?.tracks, sortMode]
  );

  const executeSearch = useCallback(
    async (q: string, tab: SearchTab = activeTab) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setScope('online');
      setSubmittedQuery(trimmed);
      setQuery(trimmed);
      setShowSuggestions(false);
      setLoading(true);
      setError(null);
      addSearchHistory(trimmed);

      try {
        const headers: Record<string, string> = {};
        if (settings.ytCookie.trim()) {
          headers['x-yt-cookie'] = settings.ytCookie.trim();
        }
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(trimmed)}&type=${tab}&gl=${settings.region}`,
          { headers }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          results?: Array<
            | (Track & { kind: 'TRACK' })
            | (AlbumSummary & { kind: 'ALBUM' })
            | (ArtistSummary & { kind: 'ARTIST' })
            | (PlaylistSummary & { kind: 'PLAYLIST' })
          >;
        };
        const items = data.results || [];
        const rawTracks = items.filter(
          (i): i is Track & { kind: 'TRACK' } => i.kind === 'TRACK'
        );
        const filteredTracks = settings.hideVideoSongs
          ? rawTracks.filter((t) => t.type !== 'VIDEO')
          : rawTracks;
        setResults({
          tracks: filteredTracks,
          albums: items.filter(
            (i): i is AlbumSummary & { kind: 'ALBUM' } => i.kind === 'ALBUM'
          ),
          artists: items.filter(
            (i): i is ArtistSummary & { kind: 'ARTIST' } => i.kind === 'ARTIST'
          ),
          playlists: items.filter(
            (i): i is PlaylistSummary & { kind: 'PLAYLIST' } => i.kind === 'PLAYLIST'
          ),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, addSearchHistory, settings.hideVideoSongs, settings.region, settings.ytCookie]
  );

  useEffect(() => {
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    const trimmed = query.trim();
    if (scope !== 'online' || trimmed.length < 2) {
      return;
    }
    if (!showSuggestions || trimmed === submittedQuery) {
      return;
    }
    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/music/search?suggest=1&q=${encodeURIComponent(trimmed)}&gl=${settings.region}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: string[] };
        setSuggestions(data.suggestions || []);
      } catch {
        // ignore autocomplete errors
      }
    }, 220);

    return () => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    };
  }, [query, scope, showSuggestions, submittedQuery, settings.region]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scope === 'local') {
      setShowSuggestions(false);
      return;
    }
    void executeSearch(query, activeTab);
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    if (submittedQuery) {
      void executeSearch(submittedQuery, tab);
    }
  };

  const handleClearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setResults(null);
    setError(null);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const renderVibeCard = (vibe: VibeCardSpec) => {
    const isBroken = Boolean(brokenImages[vibe.id]);
    return (
      <button
        key={vibe.id}
        type="button"
        data-testid={`vibe-card-${vibe.id}`}
        onClick={() => {
          setActiveTab('songs');
          void executeSearch(vibe.query, 'songs');
        }}
        style={{
          borderColor: vibe.borderColor,
          background: isBroken ? vibe.fallbackGradient : '#1D1D21',
        }}
        className={`relative w-full overflow-hidden rounded-[18px] border text-left transition-transform duration-200 active:scale-[0.985] hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--m3-primary)] group ${vibe.heightClass}`}
      >
        {!isBroken && (
          <Image
            src={vibe.image}
            alt={vibe.label}
            fill
            referrerPolicy="no-referrer"
            sizes="(max-width: 768px) 50vw, 33vw"
            onError={() =>
              setBrokenImages((prev) => ({ ...prev, [vibe.id]: true }))
            }
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              vibe.compactHorizontal ? 'object-right' : 'object-bottom'
            }`}
          />
        )}

        <div
          className={`pointer-events-none absolute inset-0 ${
            vibe.compactHorizontal
              ? 'bg-gradient-to-r from-[#1D1D21]/85 via-[#1D1D21]/25 to-transparent'
              : 'bg-gradient-to-b from-[#1D1D21]/80 via-transparent to-transparent'
          }`}
        />

        <span
          className={`pointer-events-none absolute z-10 font-bold tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)] ${
            vibe.compactHorizontal
              ? 'inset-y-0 left-4 right-20 flex items-center text-[16px] sm:text-[18px]'
              : 'top-3.5 left-3.5 right-3.5 text-[16px] sm:text-[18px] leading-snug'
          }`}
        >
          {vibe.label}
        </span>
      </button>
    );
  };

  const renderTopResultCard = (topTrack: Track, queueContext: Track[]) => (
    <section data-testid="search-top-result" className="space-y-2.5">
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
        Top Result
      </h2>
      <div className="relative overflow-hidden rounded-[26px] border border-black/5 dark:border-white/10 p-4 sm:p-5 shadow-lg">
        {topTrack.thumbnail && (
          <img
            src={topTrack.thumbnail}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-35"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--m3-surface)]/92 via-[var(--m3-surface)]/80 to-[var(--m3-surface)]/65" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => playTrack(topTrack, queueContext)}
            className="flex items-center gap-4 min-w-0 flex-1 text-left group"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden shadow-lg">
              <ArtworkImage
                src={topTrack.thumbnail}
                alt={topTrack.title}
                className="w-full h-full"
                rounded=""
                sizeHint="md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white truncate group-hover:text-[var(--m3-primary)] transition-colors">
                {topTrack.title}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-0.5">
                {topTrack.artist}
                {topTrack.duration !== null && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono-nums">
                      {formatDuration(topTrack.duration)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => playTrack(topTrack, queueContext)}
              className="h-11 px-5 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold inline-flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play Now</span>
            </button>
            <button
              type="button"
              onClick={() => void startRadio(topTrack)}
              className="h-11 px-4 rounded-full metro-surface text-xs font-semibold text-slate-800 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Radio className="w-4 h-4 text-[var(--m3-primary)]" />
              <span>Radio</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  const showBrowseHome = scope === 'online' && !submittedQuery;
  const showLocalEmptyPrompt = scope === 'local' && !query.trim();

  return (
    <div className="space-y-5 pb-36">
      {/* Top Search Bar + Online/Local Scope Toggle */}
      <div className="relative z-20 space-y-3">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          {submittedQuery && scope === 'online' && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Back to Vibes"
              className="w-11 h-11 rounded-full bg-black/[0.06] dark:bg-[#232327] flex items-center justify-center shrink-0 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="w-[18px] h-[18px] opacity-55 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (val.trim().length < 2) {
                  setSuggestions([]);
                }
                setShowSuggestions(true);
              }}
              placeholder={
                scope === 'local'
                  ? 'Search your liked songs, history, playlists & tags...'
                  : 'Search songs, artists, albums...'
              }
              aria-label={
                scope === 'local' ? 'Search Local Library' : 'Search YouTube Music'
              }
              className="w-full h-12 pl-11 pr-10 rounded-full bg-black/[0.06] dark:bg-[#232327] text-[15px] text-neutral-900 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-primary)]/50 transition-shadow"
            />
            {query && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="w-9 h-9 rounded-full flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 opacity-70" />
              </button>
            )}
          </div>
        </form>

        {/* Online vs Local Library Scope Bar + Track Sort Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Search scope"
            className="inline-flex items-center gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'online'}
              data-testid="search-scope-online"
              onClick={() => setScope('online')}
              className={cn(
                'h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap',
                scope === 'online'
                  ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'local'}
              data-testid="search-scope-local"
              onClick={() => {
                setScope('local');
                setShowSuggestions(false);
              }}
              className={cn(
                'h-8 px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap',
                scope === 'local'
                  ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <FolderSearch className="w-3.5 h-3.5" />
              <span>Local Library</span>
            </button>
          </div>

          {((scope === 'online' && submittedQuery) ||
            (scope === 'local' && query.trim().length > 0)) && (
            <div className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full metro-surface">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Sort search results"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as TrackSortMode)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="relevance" className="bg-white dark:bg-[#1A1B20]">
                  Relevance
                </option>
                <option value="title" className="bg-white dark:bg-[#1A1B20]">
                  Title A–Z
                </option>
                <option value="duration" className="bg-white dark:bg-[#1A1B20]">
                  Longest Duration
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Live Search Suggestions Dropdown (Online only) */}
        {scope === 'online' && showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[56px] z-30 rounded-2xl bg-white dark:bg-[#1E1F23] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden py-1.5">
            {suggestions.slice(0, 7).map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void executeSearch(item, activeTab);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <SearchIcon className="w-4 h-4 opacity-45 shrink-0" />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Filter Tabs (only when searching online) */}
      {scope === 'online' && submittedQuery && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {SEARCH_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={`px-4 h-9 rounded-full text-[13px] font-semibold shrink-0 transition-all ${
                  active
                    ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                    : 'border border-black/15 dark:border-white/20 text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/[0.06]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Local Library Instant Search View */}
      {scope === 'local' && (
        <div className="space-y-6">
          {showLocalEmptyPrompt ? (
            <div className="rounded-[28px] metro-surface p-8 text-center space-y-2">
              <FolderSearch className="w-8 h-8 mx-auto text-[var(--m3-primary)] opacity-80" />
              <p className="text-base font-bold text-slate-950 dark:text-white">
                Instant Local Library Search
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Type a song, artist, album, playlist name, or tag (like &ldquo;Weeknd&rdquo;, &ldquo;Night&rdquo;, or &ldquo;Focus&rdquo;) to filter your offline vault instantly.
              </p>
            </div>
          ) : sortedLocalTracks.length === 0 && localResults.playlists.length === 0 ? (
            <div className="rounded-[28px] metro-surface p-8 text-center space-y-1.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                No local matches for &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch to Online to search the full YouTube Music catalog.
              </p>
            </div>
          ) : (
            <>
              {sortedLocalTracks[0] &&
                renderTopResultCard(sortedLocalTracks[0], sortedLocalTracks)}

              {localResults.playlists.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[16px] font-bold tracking-tight">
                    Matching Playlists ({localResults.playlists.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {localResults.playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() =>
                          openDetail({ kind: 'user-playlist', id: pl.id })
                        }
                        className="p-3.5 rounded-2xl metro-surface hover:bg-[var(--m3-surface-high)] flex items-center gap-3 text-left transition-colors"
                      >
                        <ArtworkImage
                          src={pl.coverUrl || pl.tracks[0]?.thumbnail || ''}
                          alt={pl.name}
                          className="w-14 h-14 shrink-0"
                          rounded="rounded-xl"
                          sizeHint="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {pl.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {pl.tracks.length} tracks
                            {pl.tags && pl.tags.length > 0
                              ? ` · ${pl.tags.join(' · ')}`
                              : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {sortedLocalTracks.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[16px] font-bold tracking-tight">
                    Library Tracks ({sortedLocalTracks.length})
                  </h2>
                  <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
                    {sortedLocalTracks.map((track) => {
                      const active = currentTrack?.videoId === track.videoId;
                      return (
                        <div
                          key={track.videoId}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 first:rounded-t-[28px] last:rounded-b-[28px]',
                            active && 'bg-[var(--m3-primary-soft)]'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => playTrack(track, sortedLocalTracks)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          >
                            <ArtworkImage
                              src={track.thumbnail}
                              alt={track.title}
                              className="w-11 h-11 shrink-0"
                              rounded="rounded-xl"
                              sizeHint="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'text-sm font-semibold truncate',
                                  active
                                    ? 'text-[var(--m3-primary)]'
                                    : 'text-slate-900 dark:text-white'
                                )}
                              >
                                {track.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {track.artist}
                                {track.duration !== null && (
                                  <>
                                    <span aria-hidden="true"> · </span>
                                    <span className="font-mono-nums">
                                      {formatDuration(track.duration)}
                                    </span>
                                  </>
                                )}
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
            </>
          )}
        </div>
      )}

      {/* Default Browse State: Exact "Vibes" Staggered Masonry Layout + Expressive Asymmetric Moods */}
      {showBrowseHome && (
        <div className="lg:grid lg:grid-cols-12 lg:gap-7 items-start space-y-6 lg:space-y-0">
          {/* Primary Vibes Column */}
          <section className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight">
                Vibes
              </h1>
              {searchHistory.length > 0 && (
                <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[65%]">
                  {searchHistory.slice(0, 3).map((term) => (
                    <button
                      key={`quick-hist-${term}`}
                      type="button"
                      onClick={() => void executeSearch(term, 'all')}
                      className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[11.5px] font-medium shrink-0 max-w-[110px]"
                    >
                      <Clock className="w-3 h-3 opacity-55 shrink-0" />
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 items-start">
              <div className="flex flex-col gap-3 sm:gap-3.5">
                {LEFT_VIBES.map(renderVibeCard)}
              </div>
              <div className="flex flex-col gap-3 sm:gap-3.5">
                {RIGHT_VIBES.map(renderVibeCard)}
              </div>
            </div>
          </section>

          {/* Secondary Expressive Asymmetric Moods & Recent Searches */}
          <aside className="lg:col-span-4 space-y-5 lg:pt-11">
            <section className="rounded-[26px] metro-surface p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--m3-primary)]" />
                <h2 className="text-[14px] font-bold tracking-tight">
                  More Moods &amp; Regions
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                {EXTRA_MOODS.map((mood, idx) => (
                  <button
                    key={mood.label}
                    type="button"
                    onClick={() => {
                      setActiveTab('songs');
                      void executeSearch(mood.query, 'songs');
                    }}
                    className={cn(
                      'flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-left transition-all group',
                      MOOD_TILE_SHAPES[idx % MOOD_TILE_SHAPES.length]
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: mood.accent }}
                      />
                      <span className="text-[13.5px] font-semibold truncate">
                        {mood.label}
                      </span>
                    </div>
                    <Play className="w-3.5 h-3.5 opacity-40 group-hover:opacity-90 shrink-0" />
                  </button>
                ))}
              </div>
            </section>

            {searchHistory.length > 0 && (
              <section className="rounded-[26px] metro-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold tracking-tight">
                    Recent Searches
                  </h2>
                  <button
                    type="button"
                    onClick={clearSearchHistory}
                    className="inline-flex items-center gap-1 text-[12px] font-medium opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => void executeSearch(term, 'all')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12.5px] font-medium hover:bg-black/[0.08] dark:hover:bg-white/[0.11] transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 opacity-55" />
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      )}

      {/* Loading Skeleton */}
      {scope === 'online' && loading && <SearchResultsSkeleton />}

      {/* Error */}
      {scope === 'online' && error && !loading && (
        <div className="rounded-2xl metro-surface p-4 text-[13.5px] text-rose-500">
          {error}
        </div>
      )}

      {/* Online Search Results */}
      {scope === 'online' && !loading && results && submittedQuery && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Featured Top Result Card */}
          {sortedOnlineTracks[0] &&
            renderTopResultCard(sortedOnlineTracks[0], sortedOnlineTracks)}

          {/* Albums, Artists, Playlists Row */}
          {(results.artists.length > 0 ||
            results.albums.length > 0 ||
            results.playlists.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-[17px] font-bold tracking-tight">
                Artists, Albums &amp; Playlists
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
                {results.artists.slice(0, 4).map((artist) => (
                  <button
                    key={artist.artistId}
                    type="button"
                    onClick={() =>
                      openDetail({
                        kind: 'artist',
                        id: artist.artistId,
                        title: artist.name,
                        thumbnail: artist.thumbnail,
                      })
                    }
                    className="p-3 rounded-2xl metro-surface hover:brightness-105 transition-all text-center flex flex-col items-center gap-2.5"
                  >
                    <ArtworkImage
                      src={artist.thumbnail}
                      alt={artist.name}
                      className="w-24 h-24 rounded-full shadow-md"
                    />
                    <div className="min-w-0 w-full">
                      <p className="text-[13.5px] font-semibold truncate">
                        {artist.name}
                      </p>
                      <p className="text-[11.5px] opacity-60 flex items-center justify-center gap-1 mt-0.5">
                        <User className="w-3 h-3" /> Artist
                      </p>
                    </div>
                  </button>
                ))}

                {results.albums.slice(0, 6).map((album) => (
                  <button
                    key={album.albumId}
                    type="button"
                    onClick={() =>
                      openDetail({
                        kind: 'album',
                        id: album.albumId,
                        title: album.title,
                        thumbnail: album.thumbnail,
                      })
                    }
                    className="p-2.5 rounded-2xl metro-surface hover:brightness-105 transition-all text-left group"
                  >
                    <ArtworkImage
                      src={album.thumbnail}
                      alt={album.title}
                      className="w-full aspect-square rounded-xl mb-2 shadow-sm"
                    />
                    <p className="text-[13.5px] font-semibold truncate">
                      {album.title}
                    </p>
                    <p className="text-[12px] opacity-60 truncate flex items-center gap-1 mt-0.5">
                      <Disc3 className="w-3 h-3 shrink-0" />
                      {album.artist}
                      {album.year ? ` · ${album.year}` : ''}
                    </p>
                  </button>
                ))}

                {results.playlists.slice(0, 6).map((pl) => (
                  <button
                    key={pl.playlistId}
                    type="button"
                    onClick={() =>
                      openDetail({
                        kind: 'playlist',
                        id: pl.playlistId,
                        title: pl.title,
                        thumbnail: pl.thumbnail,
                      })
                    }
                    className="p-2.5 rounded-2xl metro-surface hover:brightness-105 transition-all text-left group"
                  >
                    <ArtworkImage
                      src={pl.thumbnail}
                      alt={pl.title}
                      className="w-full aspect-square rounded-xl mb-2 shadow-sm"
                    />
                    <p className="text-[13.5px] font-semibold truncate">
                      {pl.title}
                    </p>
                    <p className="text-[12px] opacity-60 truncate flex items-center gap-1 mt-0.5">
                      <ListMusic className="w-3 h-3 shrink-0" />
                      {pl.artist}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Songs / Videos List */}
          {sortedOnlineTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold tracking-tight truncate">
                  Tracks for &ldquo;{submittedQuery}&rdquo;
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    playTrack(sortedOnlineTracks[0], sortedOnlineTracks)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-[12px] font-semibold shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play All
                </button>
              </div>
              <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
                {sortedOnlineTracks.map((track, idx) => {
                  const active = currentTrack?.videoId === track.videoId;
                  return (
                    <div
                      key={`${track.videoId}-${idx}`}
                      className={`group flex items-center gap-3 px-3 sm:px-4 py-2.5 first:rounded-t-[28px] last:rounded-b-[28px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] ${
                        active ? 'bg-[var(--m3-primary)]/[0.10]' : ''
                      }`}
                    >
                      <span className="w-5 text-center text-[12px] opacity-45 tabular-nums shrink-0 hidden sm:inline">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => playTrack(track, sortedOnlineTracks)}
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
                            className={`text-[14px] font-semibold truncate ${
                              active ? 'text-[var(--m3-primary)]' : ''
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-[12.5px] opacity-60 truncate flex items-center gap-1.5">
                            {track.type === 'VIDEO' ? (
                              <Film className="w-3 h-3 shrink-0 opacity-70" />
                            ) : (
                              <Music2 className="w-3 h-3 shrink-0 opacity-70" />
                            )}
                            <span className="truncate">{track.artist}</span>
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => void startRadio(track)}
                        title="Start Radio"
                        className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium opacity-0 group-hover:opacity-80 hover:!opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        Radio
                      </button>

                      <span className="text-[12px] opacity-55 tabular-nums shrink-0 hidden sm:inline">
                        {formatDuration(track.duration)}
                      </span>
                      <TrackContextMenu track={track} />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {results.tracks.length === 0 &&
            results.albums.length === 0 &&
            results.artists.length === 0 &&
            results.playlists.length === 0 && (
              <div className="rounded-3xl metro-surface p-10 text-center space-y-2">
                <p className="text-[15px] font-semibold">
                  No results found for &ldquo;{submittedQuery}&rdquo;
                </p>
                <p className="text-[13px] opacity-60">
                  Try another artist, song title, or pick a Vibe card.
                </p>
              </div>
            )}
        </motion.div>
      )}
    </div>
  );
}
