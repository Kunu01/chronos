import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  ChevronDown,
  ChevronUp,
  X,
  Minimize2,
} from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';

const VaultMusicPlayer = () => {
  const {
    currentTrack,
    isPlaying,
    isMuted,
    togglePlay,
    playNext,
    toggleMute,
    playlist,
    currentTrackIndex,
  } = useMusic();

  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  if (!currentTrack) return null;

  return (
    <div className="fixed top-[max(env(safe-area-inset-top,0px)+48px,54px)] right-2.5 sm:top-4 sm:right-4 z-30 pointer-events-auto font-sans select-none max-w-[calc(100vw-20px)]">
      {/* Mobile Compact Trigger Pill (When collapsed on mobile to avoid overlapping Dynamic Island and controls) */}
      <div className="sm:hidden">
        {!mobileExpanded ? (
          <motion.button
            type="button"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setMobileExpanded(true)}
            className="flex items-center gap-2 rounded-full border border-rose-500/40 bg-neutral-950/90 px-3 py-1.5 text-rose-300 shadow-[0_4px_24px_rgba(244,63,94,0.35)] backdrop-blur-xl"
            title="Open Vault Soundtrack"
          >
            {isPlaying ? (
              <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2.5" />
                <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-3.5" />
                <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-1.5" />
              </div>
            ) : (
              <Music className="h-3.5 w-3.5 text-rose-400" />
            )}
            <span className="text-[11px] font-semibold text-white max-w-[100px] truncate">
              {currentTrack.title || 'Music'}
            </span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
          </motion.button>
        ) : null}
      </div>

      {/* Full Player Card (Always on desktop, conditional on mobile) */}
      <div className={`${mobileExpanded ? 'block' : 'hidden sm:block'}`}>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="rounded-2xl border border-white/15 bg-neutral-950/90 p-2 sm:p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
        >
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Animated Equalizer / Play-Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="group relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20 active:scale-95"
              title={isPlaying ? 'Pause Background Music' : 'Play Background Music'}
            >
              {isPlaying ? (
                <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                  <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2.5" />
                  <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-3.5" />
                  <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-1.5" />
                  <span className="w-0.5 bg-rose-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-3" />
                </div>
              ) : (
                <Play className="h-3.5 w-3.5 fill-rose-400 text-rose-400 ml-0.5" />
              )}
            </button>

            {/* Track Info */}
            <div
              className="flex flex-col cursor-pointer min-w-0 max-w-[120px] xs:max-w-[150px] sm:max-w-[200px]"
              onClick={() => setExpanded((e) => !e)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono uppercase tracking-widest text-rose-400 font-semibold truncate">
                  {isPlaying ? 'TUNED IN' : 'AMBIENT QUEUE'}
                </span>
                <span className="text-[9px] font-mono text-neutral-500">
                  {currentTrackIndex + 1}/{playlist.length}
                </span>
              </div>
              <span className="text-xs font-semibold text-white truncate leading-tight">
                {currentTrack.title || 'Soft Tune'}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={playNext}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
                title="Next Track in Queue"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/5 transition ${
                  isMuted ? 'text-rose-400 bg-rose-500/10' : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-white"
                title="Toggle playlist drawer"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {/* Mobile Close/Minimize Button */}
              <button
                type="button"
                onClick={() => {
                  setMobileExpanded(false);
                  setExpanded(false);
                }}
                className="sm:hidden flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-rose-300 active:scale-90"
                title="Minimize player"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Expanded Queue Drawer */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2.5 border-t border-white/10 pt-2 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Music className="h-3 w-3 text-rose-400" />
                    <span>Vault Playlist ({playlist.length})</span>
                  </span>
                  <span className="text-neutral-500">Loops Continuously</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {playlist.map((track, idx) => (
                    <div
                      key={track._id || idx}
                      className={`flex items-center justify-between p-1.5 rounded-lg border transition ${
                        idx === currentTrackIndex
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 font-semibold'
                          : 'border-white/5 bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate max-w-[180px]">
                        {idx + 1}. {track.title}
                      </span>
                      {idx === currentTrackIndex && isPlaying && (
                        <span className="text-[9px] font-mono uppercase text-rose-400 shrink-0">Playing</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default VaultMusicPlayer;
