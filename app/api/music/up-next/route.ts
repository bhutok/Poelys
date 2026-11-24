import { NextRequest, NextResponse } from 'next/server';
import { SEED_TRACKS } from '@/lib/metrolist/seed';
import { getYTMusicClient, normalizeSong } from '@/lib/server/ytmusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = (searchParams.get('videoId') || '').trim();
  const gl = searchParams.get('gl') || 'ID';

  if (!videoId) {
    return NextResponse.json({ tracks: [] }, { status: 400 });
  }

  try {
    const yt = await getYTMusicClient({ gl, hl: 'en' });
    const upNexts = await yt.getUpNexts(videoId);
    const tracks = upNexts.map(normalizeSong);
    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('UpNext API error:', error);
    return NextResponse.json({
      tracks: SEED_TRACKS.filter((t) => t.videoId !== videoId),
    });
  }
}
