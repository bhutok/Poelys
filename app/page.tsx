'use client';

import React from 'react';
import { ChartsView } from '@/components/ChartsView';
import { DetailView } from '@/components/DetailView';
import { DynamicIsland } from '@/components/DynamicIsland';
import { DynamicIslandPopup } from '@/components/DynamicIslandPopup';
import { HomeView } from '@/components/HomeView';
import { LibraryView } from '@/components/LibraryView';
import { LiquidGlassFilterDefs } from '@/components/LiquidGlassSurface';
import { MiniPlayer } from '@/components/MiniPlayer';
import { MobileBottomTabs, MobileTopBar } from '@/components/MobileNav';
import { MusicProvider, useMusic } from '@/components/MusicProvider';
import { NowPlayingSheet } from '@/components/NowPlayingSheet';
import { PlaylistPickerModal } from '@/components/PlaylistPickerModal';
import { SearchView } from '@/components/SearchView';
import { SettingsView } from '@/components/SettingsView';
import { Sidebar } from '@/components/Sidebar';

function PoelysShell() {
  const {
    activeTab,
    detailTarget,
    ytContainerRef,
    showVideoStage,
    isNowPlayingOpen,
    currentTrack,
    settings,
  } = useMusic();

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip flex flex-col lg:flex-row relative bg-[var(--m3-bg)] transition-colors duration-200">
      {settings.dockStyle === 'liquid-glass' && <LiquidGlassFilterDefs />}
      {/* In-Viewport Non-Occluded Video Stage for YouTube IFrame Player API (prevents Android Chrome offscreen iframe audio suspension) */}
      <div
        className={
          showVideoStage && isNowPlayingOpen
            ? 'fixed top-20 left-1/2 -translate-x-1/2 z-[55] w-[92vw] max-w-lg aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black'
            : 'fixed bottom-2 right-2 w-[220px] h-[124px] opacity-[0.015] pointer-events-none z-0 overflow-hidden'
        }
        aria-hidden={!showVideoStage || !isNowPlayingOpen}
      >
        <div ref={ytContainerRef} className="w-full h-full" />
      </div>

      {/* iPhone 17 / 18 Dynamic Island & Background Popup Engine */}
      <DynamicIsland />
      <DynamicIslandPopup />

      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />

        <main
          className={`flex-1 px-4 sm:px-8 pt-5 lg:pt-14 max-w-7xl w-full mx-auto pb-[calc(10rem+env(safe-area-inset-bottom))] ${
            currentTrack ? 'lg:pb-32' : 'lg:pb-14'
          }`}
        >
          {detailTarget ? (
            <DetailView />
          ) : activeTab === 'home' ? (
            <HomeView />
          ) : activeTab === 'search' ? (
            <SearchView />
          ) : activeTab === 'charts' ? (
            <ChartsView />
          ) : activeTab === 'library' ? (
            <LibraryView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>

      <MiniPlayer />
      <MobileBottomTabs />
      <NowPlayingSheet />
      <PlaylistPickerModal />
    </div>
  );
}

export default function Page() {
  return (
    <MusicProvider>
      <PoelysShell />
    </MusicProvider>
  );
}
