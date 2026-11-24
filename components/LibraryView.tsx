'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Clock,
  FolderHeart,
  Heart,
  LayoutGrid,
  Link2,
  List,
  ListMusic,
  Loader2,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ArtworkImage } from './ArtworkImage';
import { useMusic } from './MusicProvider';
import { StatsView } from './StatsView';
import { TrackContextMenu } from './TrackContextMenu';
import { formatDuration } from '@/lib/metrolist/lyrics';
import {
  buildAutoTopMixes,
  filterTracksByQuery,
  sortLibraryTracks,
  type LibraryTrackSortMode,
} from '@/lib/metrolist/statsEngine';
import { cn } from '@/lib/utils';

type LibraryTab = 'playlists' | 'liked' | 'history' | 'stats' | 'saved';
type ViewLayout = 'grid' | 'list';

function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.startsWith('http')) {
      const u = new URL(trimmed);
      return u.searchParams.get('list') || '';
    }
  } catch {
    // treat as raw id
  }
  return trimmed;
}

const SORT_OPTIONS: Array<{ id: LibraryTrackSortMode; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'artist', label: 'Artist' },
  { id: 'mostPlayed', label: 'Most Played' },
  { id: 'duration', label: 'Duration' },
];

export function LibraryView() {
  const {
    likedTracks,
    history,
    playlists,
    savedCollection,
    createPlaylist,
    updatePlaylistTags,
    deletePlaylist,
    openDetail,
    playTrack,
    currentTrack,
    settings,
    showToast,
  } = useMusic();

  const [tab, setTab] = useState<LibraryTab>('playlists');
  const [viewMode, setViewMode] = useState<ViewLayout>('grid');
  const [sortMode, setSortMode] = useState<LibraryTrackSortMode>('recent');
  const [localFilter, setLocalFilter] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTagPlaylistId, setEditingTagPlaylistId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [importInput, setImportInput] = useState('');
  const [importing, setImporting] = useState(false);

  const autoMixes = useMemo(
    () => buildAutoTopMixes(history, likedTracks),
    [history, likedTracks]
  );

  const allPlaylistTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const pl of playlists) {
      for (const t of pl.tags || []) {
        if (t.trim()) tagSet.add(t.trim());
      }
    }
    return Array.from(tagSet);
  }, [playlists]);

  const filteredPlaylists = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    return playlists.filter((pl) => {
      if (selectedTag && !(pl.tags || []).includes(selectedTag)) return false;
      if (!q) return true;
      return (
        pl.name.toLowerCase().includes(q) ||
        (pl.description?.toLowerCase().includes(q) ?? false) ||
        (pl.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [playlists, selectedTag, localFilter]);

  const displayedLikedTracks = useMemo(() => {
    const filtered = filterTracksByQuery(likedTracks, localFilter);
    return sortLibraryTracks(filtered, sortMode, history);
  }, [likedTracks, localFilter, sortMode, history]);

  const displayedHistory = useMemo(() => {
    const q = localFilter.trim().toLowerCase();
    const filtered = q
      ? history.filter(
          (ev) =>
            ev.track.title.toLowerCase().includes(q) ||
            ev.track.artist.toLowerCase().includes(q)
        )
      : history;
    if (sortMode === 'mostPlayed') {
      return [...filtered].sort((a, b) => b.playCount - a.playCount);
    }
    if (sortMode === 'title') {
      return [...filtered].sort((a, b) => a.track.title.localeCompare(b.track.title));
    }
    if (sortMode === 'artist') {
      return [...filtered].sort((a, b) => a.track.artist.localeCompare(b.track.artist));
    }
    return filtered;
  }, [history, localFilter, sortMode]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
  };

  const handleImportYtmPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = extractPlaylistId(importInput);
    if (!pid) return;
    setImporting(true);
    try {
      const res = await fetch(
        `/api/music/detail?kind=playlist&id=${encodeURIComponent(pid)}&gl=${settings.region}`
      );
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as {
        title?: string;
        tracks?: Parameters<typeof createPlaylist>[2];
      };
      if (data.tracks && data.tracks.length > 0) {
        createPlaylist(
          data.title || `Imported (${pid.slice(0, 8)})`,
          'Imported from YouTube Music',
          data.tracks
        );
        setImportInput('');
      } else {
        showToast('No tracks found in that YouTube Music playlist');
      }
    } catch {
      showToast('Could not import playlist. Check the URL or ID.');
    } finally {
      setImporting(false);
    }
  };

  const handleAddTag = (playlistId: string, existingTags: string[] = []) => {
    const cleaned = tagDraft.trim();
    if (!cleaned) return;
    updatePlaylistTags(playlistId, [...existingTags, cleaned]);
    setTagDraft('');
    setEditingTagPlaylistId(null);
  };

  return (
    <div data-testid="library-view" className="space-y-6 pb-36">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {playlists.length} playlists · {likedTracks.length} liked · {history.length} played
          </p>
        </div>

        {/* Expressive 5-Tab Switcher */}
        <div
          role="tablist"
          aria-label="Library sections"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1"
        >
          {(
            [
              { id: 'playlists', label: 'Playlists', icon: ListMusic },
              { id: 'liked', label: 'Liked', icon: Heart },
              { id: 'history', label: 'History', icon: Clock },
              { id: 'stats', label: 'Stats', icon: BarChart3 },
              { id: 'saved', label: 'Saved', icon: FolderHeart },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`library-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className={cn(
                  'h-9 sm:h-10 px-3 sm:px-4 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0',
                  active
                    ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm'
                    : 'metro-surface text-slate-700 dark:text-slate-200 hover:bg-[var(--m3-surface-high)]'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats & Year-in-Music Recap Tab */}
      {tab === 'stats' && <StatsView />}

      {/* Local Filter + Sort + View Toggle Bar (for Playlists / Liked / History / Saved) */}
      {tab !== 'stats' && (
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              placeholder={`Filter ${tab}...`}
              aria-label="Filter library"
              data-testid="library-filter-input"
              className="w-full h-10 pl-10 pr-9 rounded-full metro-surface text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
            />
            {localFilter && (
              <button
                type="button"
                onClick={() => setLocalFilter('')}
                aria-label="Clear library filter"
                className="w-8 h-8 rounded-full flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(tab === 'liked' || tab === 'history') && (
              <div className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full metro-surface">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  aria-label="Sort tracks"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as LibraryTrackSortMode)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option
                      key={opt.id}
                      value={opt.id}
                      className="bg-white dark:bg-[#1A1B20]"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(tab === 'playlists' || tab === 'saved') && (
              <div className="inline-flex items-center gap-1 p-1 rounded-full metro-surface">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    viewMode === 'grid'
                      ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  aria-pressed={viewMode === 'list'}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    viewMode === 'list'
                      ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playlists Tab */}
      {tab === 'playlists' && (
        <div className="space-y-7">
          {/* Auto-Generated Top Mixes (ArchiveTune LibraryTopMix) */}
          {autoMixes.length > 0 && !localFilter && !selectedTag && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-slate-950 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--m3-primary)]" />
                  <span>Auto Top Mixes</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('stats')}
                  className="text-xs font-semibold text-[var(--m3-primary)] hover:underline"
                >
                  Open Listening Stats
                </button>
              </div>

              <div
                data-testid="auto-top-mixes"
                className="grid grid-cols-1 sm:grid-cols-3 gap-3.5"
              >
                {autoMixes.map((mix) => (
                  <button
                    key={mix.id}
                    type="button"
                    onClick={() => playTrack(mix.tracks[0], mix.tracks)}
                    style={{
                      background: `linear-gradient(135deg, ${mix.accentFrom}, ${mix.accentTo})`,
                    }}
                    className="relative overflow-hidden rounded-[26px] p-4 text-left text-white shadow-lg group hover:scale-[1.01] active:scale-[0.99] transition-transform flex items-center gap-3.5"
                  >
                    {/* 2x2 Mini Collage */}
                    <div className="w-16 h-16 rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-[1px] bg-black/30 shrink-0 shadow-md">
                      {[0, 1, 2, 3].map((slot) => {
                        const src = mix.covers[slot] || mix.covers[0] || '';
                        return (
                          <ArtworkImage
                            key={`${mix.id}-c-${slot}`}
                            src={src}
                            alt=""
                            className="w-full h-full"
                            rounded=""
                            sizeHint="sm"
                          />
                        );
                      })}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold tracking-tight truncate">
                        {mix.title}
                      </p>
                      <p className="text-xs text-white/80 truncate mt-0.5">
                        {mix.subtitle}
                      </p>
                    </div>

                    <span className="w-10 h-10 rounded-full bg-white/20 group-hover:bg-white group-hover:text-slate-950 flex items-center justify-center shrink-0 transition-colors">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Create & Import Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <form
              onSubmit={handleCreatePlaylist}
              className="rounded-3xl metro-surface p-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Create a new playlist..."
                aria-label="Playlist name"
                className="flex-1 h-10 px-3.5 rounded-2xl bg-black/5 dark:bg-white/[0.06] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
              />
              <button
                type="submit"
                disabled={!newPlaylistName.trim()}
                className="h-10 px-4 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create</span>
              </button>
            </form>

            <form
              onSubmit={handleImportYtmPlaylist}
              className="rounded-3xl metro-surface p-3 flex items-center gap-2"
            >
              <Link2 className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
              <input
                type="text"
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="Import YTM Playlist URL or ID..."
                aria-label="YouTube Music playlist URL or ID"
                className="flex-1 h-10 px-3.5 rounded-2xl bg-black/5 dark:bg-white/[0.06] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--m3-ring)]"
              />
              <button
                type="submit"
                disabled={!importInput.trim() || importing}
                className="h-10 px-4 rounded-full bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Import</span>
                )}
              </button>
            </form>
          </div>

          {/* Playlist Tag Filter Bar */}
          {allPlaylistTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={cn(
                  'h-8 px-3 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                  selectedTag === null
                    ? 'bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                    : 'metro-surface text-slate-600 dark:text-slate-300'
                )}
              >
                All Tags
              </button>
              {allPlaylistTags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    data-testid={`playlist-tag-filter-${tag.toLowerCase()}`}
                    onClick={() => setSelectedTag(active ? null : tag)}
                    className={cn(
                      'h-8 px-3 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                      active
                        ? 'bg-[var(--m3-primary)] text-[var(--m3-on-primary)]'
                        : 'metro-surface text-slate-600 dark:text-slate-300 hover:bg-[var(--m3-surface-high)]'
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* Playlists Grid or List */}
          {filteredPlaylists.length === 0 ? (
            <div className="rounded-[28px] metro-surface p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {playlists.length === 0
                ? 'No playlists yet. Create one above to start organizing your tracks.'
                : 'No playlists match your current filter or tag.'}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaylists.map((pl) => {
                const cover = pl.coverUrl || pl.tracks[0]?.thumbnail || '';
                const tags = pl.tags || [];
                const isEditingTag = editingTagPlaylistId === pl.id;

                return (
                  <div
                    key={pl.id}
                    className="rounded-[26px] metro-surface p-4 flex flex-col gap-3 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          openDetail({ kind: 'user-playlist', id: pl.id })
                        }
                        className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                      >
                        <ArtworkImage
                          src={cover}
                          alt={pl.name}
                          className="w-16 h-16 shrink-0 shadow-sm"
                          rounded="rounded-2xl"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-[var(--m3-primary)] transition-colors">
                            {pl.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums mt-0.5">
                            {pl.tracks.length} {pl.tracks.length === 1 ? 'track' : 'tracks'}
                            {tags.length > 0 && ` · ${tags.join(', ')}`}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {pl.tracks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => playTrack(pl.tracks[0], pl.tracks)}
                            aria-label={`Play ${pl.name}`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] shadow-sm hover:scale-105 transition-transform"
                          >
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePlaylist(pl.id)}
                          aria-label={`Delete playlist ${pl.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-400 hover:text-[var(--m3-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Tag Manager Footer */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/[0.06]">
                      {isEditingTag ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddTag(pl.id, tags);
                          }}
                          className="flex items-center gap-1.5 flex-1"
                        >
                          <input
                            type="text"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="Add tag (e.g. Chill)..."
                            aria-label="New playlist tag"
                            className="flex-1 h-8 px-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="h-8 px-3 rounded-xl bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagPlaylistId(null);
                              setTagDraft('');
                            }}
                            aria-label="Cancel adding tag"
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                            {tags.length > 0 ? tags.map((t) => `#${t}`).join(' ') : 'No tags'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagPlaylistId(pl.id);
                              setTagDraft('');
                            }}
                            className="text-[11.5px] font-semibold text-[var(--m3-primary)] hover:underline whitespace-nowrap shrink-0"
                          >
                            + Tag
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {filteredPlaylists.map((pl) => {
                const cover = pl.coverUrl || pl.tracks[0]?.thumbnail || '';
                return (
                  <div
                    key={pl.id}
                    className="flex items-center gap-3 px-4 py-3 first:rounded-t-[28px] last:rounded-b-[28px] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openDetail({ kind: 'user-playlist', id: pl.id })
                      }
                      className="flex items-center gap-3.5 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={cover}
                        alt={pl.name}
                        className="w-12 h-12 shrink-0"
                        rounded="rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {pl.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {pl.tracks.length} tracks
                          {pl.tags && pl.tags.length > 0 && ` · ${pl.tags.map((t) => `#${t}`).join(' ')}`}
                        </p>
                      </div>
                    </button>
                    {pl.tracks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => playTrack(pl.tracks[0], pl.tracks)}
                        aria-label={`Play ${pl.name}`}
                        className="w-9 h-9 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] flex items-center justify-center shrink-0"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePlaylist(pl.id)}
                      aria-label={`Delete playlist ${pl.name}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-[var(--m3-primary)] shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Liked Songs Tab */}
      {tab === 'liked' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Liked Songs ({displayedLikedTracks.length})
            </h2>
            {displayedLikedTracks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    playTrack(displayedLikedTracks[0], displayedLikedTracks)
                  }
                  className="h-9 px-4 rounded-full bg-[var(--m3-primary)] text-[var(--m3-on-primary)] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = Math.floor(Math.random() * displayedLikedTracks.length);
                    playTrack(displayedLikedTracks[idx], displayedLikedTracks);
                  }}
                  aria-label="Shuffle liked songs"
                  className="h-9 px-3.5 rounded-full metro-surface text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>Shuffle</span>
                </button>
              </div>
            )}
          </div>

          {displayedLikedTracks.length === 0 ? (
            <div className="rounded-[28px] metro-surface p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {likedTracks.length === 0
                ? 'Tap the heart icon on any song to build your Liked Songs vault.'
                : 'No liked songs match your filter.'}
            </div>
          ) : (
            <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {displayedLikedTracks.map((track) => {
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
                      onClick={() => playTrack(track, displayedLikedTracks)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-11 h-11"
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
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Recently Played ({displayedHistory.length})
          </h2>
          {displayedHistory.length === 0 ? (
            <div className="rounded-[28px] metro-surface p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              {history.length === 0
                ? 'No listening history recorded yet.'
                : 'No history entries match your filter.'}
            </div>
          ) : (
            <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {displayedHistory.map((event) => {
                const track = event.track;
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
                      onClick={() =>
                        playTrack(
                          track,
                          displayedHistory.map((h) => h.track)
                        )
                      }
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <ArtworkImage
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-11 h-11"
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
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono-nums">
                            {event.playCount} plays
                          </span>
                        </p>
                      </div>
                    </button>
                    <TrackContextMenu track={track} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved Albums/Playlists/Artists */}
      {tab === 'saved' && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Saved Collections ({savedCollection.length})
          </h2>
          {savedCollection.length === 0 ? (
            <div className="rounded-[28px] metro-surface p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Open any album, playlist, or artist and tap Save to keep it here.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {savedCollection
                .filter((item) => {
                  const q = localFilter.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    item.title.toLowerCase().includes(q) ||
                    item.subtitle.toLowerCase().includes(q)
                  );
                })
                .map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() =>
                      openDetail({
                        kind: item.kind,
                        id: item.id,
                        title: item.title,
                        thumbnail: item.thumbnail,
                      })
                    }
                    className="text-left p-3 rounded-[24px] metro-surface hover:bg-[var(--m3-surface-high)] space-y-2 transition-colors"
                  >
                    <ArtworkImage
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full aspect-square"
                      rounded={item.kind === 'artist' ? 'rounded-full' : 'rounded-2xl'}
                    />
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </button>
                ))}
            </div>
          ) : (
            <div className="rounded-[28px] metro-surface divide-y divide-black/5 dark:divide-white/[0.06]">
              {savedCollection
                .filter((item) => {
                  const q = localFilter.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    item.title.toLowerCase().includes(q) ||
                    item.subtitle.toLowerCase().includes(q)
                  );
                })
                .map((item) => (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() =>
                      openDetail({
                        kind: item.kind,
                        id: item.id,
                        title: item.title,
                        thumbnail: item.thumbnail,
                      })
                    }
                    className="w-full flex items-center gap-3.5 px-4 py-3 text-left first:rounded-t-[28px] last:rounded-b-[28px] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <ArtworkImage
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-12 shrink-0"
                      rounded={item.kind === 'artist' ? 'rounded-full' : 'rounded-xl'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
