import { NextRequest, NextResponse } from 'next/server';
import {
  getYTMusicClient,
  normalizeAlbum,
  normalizeArtist,
  normalizePlaylist,
  normalizeSearchItem,
  normalizeSong,
  normalizeVideo,
} from '@/lib/server/ytmusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim();
  const type = (searchParams.get('type') || 'all').toLowerCase();
  const gl = searchParams.get('gl') || 'ID';
  const suggest = searchParams.get('suggest') === '1';

  if (!query) {
    return NextResponse.json({ results: [], suggestions: [] });
  }

  try {
    const yt = await getYTMusicClient({ gl, hl: 'en' });

    if (suggest) {
      const suggestions = await yt.getSearchSuggestions(query);
      return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
    }

    if (type === 'songs') {
      const songs = await yt.searchSongs(query);
      return NextResponse.json({
        results: songs.map((s) => ({ ...normalizeSong(s), kind: 'TRACK' })),
      });
    }

    if (type === 'videos') {
      const videos = await yt.searchVideos(query);
      return NextResponse.json({
        results: videos.map((v) => ({ ...normalizeVideo(v), kind: 'TRACK' })),
      });
    }

    if (type === 'albums') {
      const albums = await yt.searchAlbums(query);
      return NextResponse.json({
        results: albums.map((a) => ({ ...normalizeAlbum(a), kind: 'ALBUM' })),
      });
    }

    if (type === 'artists') {
      const artists = await yt.searchArtists(query);
      return NextResponse.json({
        results: artists.map((a) => ({ ...normalizeArtist(a), kind: 'ARTIST' })),
      });
    }

    if (type === 'playlists') {
      const playlists = await yt.searchPlaylists(query);
      return NextResponse.json({
        results: playlists.map((p) => ({
          ...normalizePlaylist(p),
          kind: 'PLAYLIST',
        })),
      });
    }

    const mixed = await yt.search(query);
    const normalized = mixed
      .map(normalizeSearchItem)
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ results: normalized });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search temporarily unavailable', results: [], suggestions: [] },
      { status: 500 }
    );
  }
}
