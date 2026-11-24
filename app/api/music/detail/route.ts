import { NextRequest, NextResponse } from 'next/server';
import {
  getYTMusicClient,
  normalizeAlbum,
  normalizePlaylist,
  normalizeSong,
  normalizeVideo,
  pickBestThumbnail,
} from '@/lib/server/ytmusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const id = (searchParams.get('id') || '').trim();
  const gl = searchParams.get('gl') || 'ID';

  if (!kind || !id) {
    return NextResponse.json({ error: 'Missing kind or id' }, { status: 400 });
  }

  try {
    const yt = await getYTMusicClient({ gl, hl: 'en' });

    if (kind === 'album') {
      const album = await yt.getAlbum(id);
      return NextResponse.json({
        kind: 'album',
        id: album.albumId,
        playlistId: album.playlistId,
        title: album.name,
        subtitle: `${album.artist?.name || 'Artist'}${album.year ? ` · ${album.year}` : ''}`,
        thumbnail: pickBestThumbnail(album.thumbnails),
        tracks: album.songs.map((s) => ({
          ...normalizeSong(s),
          thumbnail: pickBestThumbnail(s.thumbnails, s.videoId) || pickBestThumbnail(album.thumbnails),
        })),
      });
    }

    if (kind === 'playlist') {
      const [playlist, videos] = await Promise.all([
        yt.getPlaylist(id),
        yt.getPlaylistVideos(id),
      ]);
      return NextResponse.json({
        kind: 'playlist',
        id: playlist.playlistId,
        title: playlist.name,
        subtitle: `${playlist.artist?.name || 'YouTube Music'} · ${videos.length || playlist.videoCount} tracks`,
        thumbnail: pickBestThumbnail(playlist.thumbnails),
        tracks: videos.map((v) => ({
          ...normalizeVideo(v),
          // Playlist entries returned by getPlaylistVideos are typed VIDEO by ytmusic-api; treat as SONG if inside curated music playlist unless clearly MV
          type: 'SONG' as const,
        })),
      });
    }

    if (kind === 'artist') {
      const artist = await yt.getArtist(id);
      return NextResponse.json({
        kind: 'artist',
        id: artist.artistId,
        title: artist.name,
        subtitle: 'Artist',
        thumbnail: pickBestThumbnail(artist.thumbnails),
        tracks: artist.topSongs.map(normalizeSong),
        albums: [...artist.topAlbums, ...artist.topSingles].map(normalizeAlbum),
        featuredOn: artist.featuredOn.map(normalizePlaylist),
      });
    }

    return NextResponse.json({ error: 'Unsupported detail kind' }, { status: 400 });
  } catch (error) {
    console.error('Detail API error:', error);
    return NextResponse.json(
      { error: 'Could not load details for this item' },
      { status: 500 }
    );
  }
}
