import { NextRequest, NextResponse } from 'next/server';
import { SEED_TRACKS } from '@/lib/metrolist/seed';
import type { HomeShelf, Track } from '@/lib/metrolist/types';
import {
  getYTMusicClient,
  normalizeHomeSections,
  normalizeSong,
} from '@/lib/server/ytmusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MOOD_QUERY_MAP: Record<string, string> = {
  energize: 'upbeat pop dance hits',
  relax: 'chill acoustic ambient indie',
  focus: 'lofi beats instrumental study',
  workout: 'high energy workout gym music',
  commute: 'feel good driving songs',
  party: 'top dance party hits',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gl = searchParams.get('gl') || 'ID';
  const mood = (searchParams.get('mood') || 'all').toLowerCase();
  const cookie = req.headers.get('x-yt-cookie') || undefined;

  try {
    const yt = await getYTMusicClient({ gl, hl: 'en', cookies: cookie });

    if (mood !== 'all' && MOOD_QUERY_MAP[mood]) {
      const [songs, playlists] = await Promise.all([
        yt.searchSongs(MOOD_QUERY_MAP[mood]).then((res) => res.slice(0, 16)),
        yt.searchPlaylists(MOOD_QUERY_MAP[mood]).then((res) => res.slice(0, 8)),
      ]);

      const moodTracks = songs.map(normalizeSong);
      const shelves: HomeShelf[] = [
        {
          id: `mood-tracks-${mood}`,
          title: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Picks`,
          items: moodTracks.map((t) => ({ ...t, kind: 'TRACK' as const })),
        },
        {
          id: `mood-playlists-${mood}`,
          title: `${mood.charAt(0).toUpperCase() + mood.slice(1)} Mixes & Playlists`,
          items: playlists.map((p) => ({
            type: 'PLAYLIST' as const,
            kind: 'PLAYLIST' as const,
            playlistId: p.playlistId,
            title: p.name,
            artist: p.artist?.name || 'YouTube Music',
            thumbnail: p.thumbnails[p.thumbnails.length - 1]?.url || '',
          })),
        },
      ];

      return NextResponse.json({
        shelves,
        quickPickCandidates: moodTracks,
        source: 'ytmusic-api',
      });
    }

    const [rawSections, chartSongs] = await Promise.all([
      yt.getHomeSections(),
      yt.searchSongs(gl === 'ID' ? 'top hits indonesia' : 'top global hits').catch(() => []),
    ]);

    const shelves = normalizeHomeSections(rawSections);
    const chartTracks: Track[] = chartSongs.slice(0, 16).map(normalizeSong);

    const shelfTracks: Track[] = [];
    for (const shelf of shelves) {
      for (const item of shelf.items) {
        if (item.kind === 'TRACK') {
          shelfTracks.push(item);
        }
      }
    }

    const quickPickCandidates =
      chartTracks.length > 0 ? [...chartTracks, ...shelfTracks] : shelfTracks;

    return NextResponse.json({
      shelves,
      quickPickCandidates: quickPickCandidates.slice(0, 32),
      source: 'ytmusic-api',
    });
  } catch (error) {
    console.error('Home API fallback triggered:', error);
    return NextResponse.json({
      shelves: [
        {
          id: 'fallback-essentials',
          title: 'Essential Mixes',
          items: SEED_TRACKS.map((t) => ({ ...t, kind: 'TRACK' as const })),
        },
      ],
      quickPickCandidates: SEED_TRACKS,
      source: 'fallback',
    });
  }
}
