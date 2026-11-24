'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Heart,
  ListEnd,
  ListPlus,
  MoreHorizontal,
  Play,
  Radio,
  User,
} from 'lucide-react';
import { useMusic } from './MusicProvider';
import type { Track } from '@/lib/metrolist/types';

interface TrackContextMenuProps {
  track: Track;
}

export function TrackContextMenu({ track }: TrackContextMenuProps) {
  const {
    playNextInQueue,
    addTrackToQueue,
    startRadio,
    openPlaylistPicker,
    isLiked,
    toggleLike,
    openDetail,
  } = useMusic();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const liked = isLiked(track.videoId);
  const primaryArtistId = track.artists?.[0]?.artistId;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`More actions for ${track.title}`}
        aria-expanded={open}
        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-11 z-50 w-56 rounded-2xl liquid-glass-elevated p-1.5 text-sm shadow-2xl"
        >
          <button
            type="button"
            onClick={() => {
              playNextInQueue(track);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-[var(--m3-primary)]" />
            <span>Play Next</span>
          </button>

          <button
            type="button"
            onClick={() => {
              addTrackToQueue(track);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <ListEnd className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Add to Queue</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void startRadio(track);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Radio className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Start Radio</span>
          </button>

          <button
            type="button"
            onClick={() => {
              openPlaylistPicker(track);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <ListPlus className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Add to Playlist</span>
          </button>

          <button
            type="button"
            onClick={() => {
              toggleLike(track);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Heart
              className={`w-4 h-4 ${
                liked
                  ? 'fill-[var(--m3-primary)] text-[var(--m3-primary)]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            />
            <span>{liked ? 'Remove Like' : 'Like Song'}</span>
          </button>

          {primaryArtistId && (
            <button
              type="button"
              onClick={() => {
                openDetail({
                  kind: 'artist',
                  id: primaryArtistId,
                  title: track.artists[0].name,
                });
                setOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-slate-800 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>View Artist</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
