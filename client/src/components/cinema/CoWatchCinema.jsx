import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Upload,
  Radio,
  Link2,
  Film,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const formatDuration = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const extractYoutubeVideoId = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const u = new URL(normalized);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '').slice(0, 11) || null;
    }
    if (u.pathname.includes('/embed/')) {
      return u.pathname.split('/embed/')[1]?.split('/')[0]?.slice(0, 11) || null;
    }
    if (u.pathname.includes('/shorts/')) {
      return u.pathname.split('/shorts/')[1]?.split('/')[0]?.slice(0, 11) || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
  } catch {
    return null;
  }
  return null;
};

let ytApiPromise = null;
const loadYouTubeIframeAPI = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      resolve(window.YT);
    };
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
};

const CoWatchCinema = ({ webrtc }) => {
  const { role } = useAuth();
  const { socket } = useSocket();
  const { remoteCastStream, cinemaFallbackTriggered, attachLocalMovieStream } =
    webrtc;

  const videoRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const suppressSyncRef = useRef(false);

  const [mode, setMode] = useState('LOCAL_CAST'); // 'LOCAL_CAST' | 'YOUTUBE_SYNC'
  const [localFileUrl, setLocalFileUrl] = useState(null);
  const [localFileName, setLocalFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [ytReady, setYtReady] = useState(false);

  const isHost = Boolean(localFileUrl) && mode === 'LOCAL_CAST';
  const youtubeMode = mode === 'YOUTUBE_SYNC' && Boolean(youtubeVideoId);

  const emitSyncAction = useCallback(
    (action, timestamp) => {
      if (!socket) return;
      socket.emit('cinema:control', {
        action,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        sentAt: Date.now(),
        actor: role,
        streamMode: youtubeMode ? 'youtube' : 'local',
        mediaTitle: youtubeMode ? youtubeVideoId : localFileName,
      });
    },
    [socket, role, youtubeMode, youtubeVideoId, localFileName]
  );

  // Attach WebRTC remote movie stream if no local video loaded
  useEffect(() => {
    if (videoRef.current && remoteCastStream && !localFileUrl) {
      videoRef.current.srcObject = remoteCastStream;
    }
  }, [remoteCastStream, localFileUrl]);

  // Mount & sync YouTube IFrame Player API
  useEffect(() => {
    if (mode !== 'YOUTUBE_SYNC' || !youtubeVideoId) return undefined;
    let cancelled = false;

    setYtReady(false);
    setCurrentTime(0);
    setDuration(0);

    loadYouTubeIframeAPI().then((YT) => {
      if (cancelled || !YT || !ytContainerRef.current) return;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }

      ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
        videoId: youtubeVideoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (ev) => {
            if (cancelled) return;
            setYtReady(true);
            const dur = ev.target.getDuration?.() || 0;
            setDuration(dur);
          },
          onStateChange: (ev) => {
            if (cancelled || suppressSyncRef.current) return;
            const player = ev.target;
            const nowTime = player.getCurrentTime?.() || 0;
            const dur = player.getDuration?.() || 0;
            if (dur > 0) setDuration(dur);

            if (ev.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              emitSyncAction('PLAY', nowTime);
            } else if (ev.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              emitSyncAction('PAUSE', nowTime);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
      setYtReady(false);
    };
  }, [mode, youtubeVideoId]);

  // Poll YouTube player timeline for smooth scrub slider & timestamp readout
  useEffect(() => {
    if (!youtubeMode || !ytReady) return undefined;
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime?.();
        const d = player.getDuration?.();
        if (Number.isFinite(t)) setCurrentTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch {
        // ignore transient player read errors
      }
    }, 350);
    return () => clearInterval(interval);
  }, [youtubeMode, ytReady]);

  // Socket control sync handler for BOTH YouTube and Local Video
  useEffect(() => {
    if (!socket) return;

    const suppressBriefly = () => {
      suppressSyncRef.current = true;
      setTimeout(() => {
        suppressSyncRef.current = false;
      }, 550);
    };

    const handleControl = (payload) => {
      if (!payload || payload.actor === role) return;
      const latencyOffsetSec = payload.sentAt
        ? Math.max(0, (Date.now() - payload.sentAt) / 1000)
        : 0;
      const targetTime = Math.max(
        0,
        (payload.timestamp || 0) + (payload.action === 'PLAY' ? latencyOffsetSec : 0)
      );

      // Apply to YouTube player if in YouTube sync mode
      if (payload.streamMode === 'youtube' || mode === 'YOUTUBE_SYNC') {
        if (payload.mediaTitle && payload.mediaTitle !== youtubeVideoId) {
          setYoutubeVideoId(payload.mediaTitle);
          setMode('YOUTUBE_SYNC');
        }
        const player = ytPlayerRef.current;
        if (!player) return;
        suppressBriefly();
        try {
          const currentYt = player.getCurrentTime?.() || 0;
          if (
            payload.action === 'SEEK' ||
            Math.abs(currentYt - targetTime) > 0.75
          ) {
            player.seekTo?.(targetTime, true);
            setCurrentTime(targetTime);
          }
          if (payload.action === 'PLAY') {
            player.playVideo?.();
            setIsPlaying(true);
          } else if (payload.action === 'PAUSE') {
            player.pauseVideo?.();
            setIsPlaying(false);
          }
        } catch {
          // ignore
        }
        return;
      }

      // Apply to Local HTML5 Video
      const vid = videoRef.current;
      if (!vid) return;
      if (payload.action === 'SEEK' || Math.abs(vid.currentTime - targetTime) > 0.45) {
        vid.currentTime = targetTime;
        setCurrentTime(targetTime);
      }
      if (payload.action === 'PLAY') {
        vid.play().catch(() => {});
        setIsPlaying(true);
      } else if (payload.action === 'PAUSE') {
        vid.pause();
        setIsPlaying(false);
      }
    };

    const handleFallback = (payload) => {
      if (payload?.youtubeUrl) {
        const parsedId = extractYoutubeVideoId(payload.youtubeUrl);
        if (parsedId) {
          setYoutubeVideoId(parsedId);
          setYoutubeInput(payload.youtubeUrl);
          setMode('YOUTUBE_SYNC');
          setIsPlaying(false);
        }
      }
    };

    socket.on('cinema:control', handleControl);
    socket.on('cinema:sync_fallback', handleFallback);

    return () => {
      socket.off('cinema:control', handleControl);
      socket.off('cinema:sync_fallback', handleFallback);
    };
  }, [socket, role, mode, youtubeVideoId]);

  useEffect(() => {
    if (cinemaFallbackTriggered) {
      setMode('YOUTUBE_SYNC');
      if (!youtubeVideoId) {
        setYoutubeVideoId('jfKfPfyJRdk');
      }
    }
  }, [cinemaFallbackTriggered, youtubeVideoId]);

  const handleSelectMovieFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localFileUrl) URL.revokeObjectURL(localFileUrl);
    const url = URL.createObjectURL(file);
    setLocalFileUrl(url);
    setLocalFileName(file.name);
    setMode('LOCAL_CAST');
    setIsPlaying(false);
  };

  const handleStartLiveCast = async () => {
    if (!videoRef.current) return;
    await attachLocalMovieStream(videoRef.current);
  };

  const handleShareYoutubeUrl = (e) => {
    e.preventDefault();
    const parsedId = extractYoutubeVideoId(youtubeInput);
    if (!parsedId) return;

    setYoutubeVideoId(parsedId);
    setMode('YOUTUBE_SYNC');
    if (socket) {
      socket.emit('cinema:sync_fallback', {
        youtubeUrl: `https://www.youtube.com/watch?v=${parsedId}`,
        reason: 'Shared YouTube watch link',
        actor: role,
      });
    }
  };

  const seekByDelta = (deltaSec) => {
    if (youtubeMode && ytPlayerRef.current) {
      const curr = ytPlayerRef.current.getCurrentTime?.() || currentTime;
      const maxDur = duration || 999999;
      const next = Math.max(0, Math.min(maxDur, curr + deltaSec));
      suppressSyncRef.current = true;
      ytPlayerRef.current.seekTo?.(next, true);
      setCurrentTime(next);
      setTimeout(() => {
        suppressSyncRef.current = false;
      }, 450);
      emitSyncAction('SEEK', next);
      return;
    }

    const vid = videoRef.current;
    if (!vid) return;
    const next = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + deltaSec));
    vid.currentTime = next;
    setCurrentTime(next);
    emitSyncAction('SEEK', next);
  };

  const handleScrub = (e) => {
    const next = Number(e.target.value);
    setCurrentTime(next);
    if (youtubeMode && ytPlayerRef.current) {
      suppressSyncRef.current = true;
      ytPlayerRef.current.seekTo?.(next, true);
      setTimeout(() => {
        suppressSyncRef.current = false;
      }, 450);
      emitSyncAction('SEEK', next);
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = next;
      emitSyncAction('SEEK', next);
    }
  };

  const togglePlayPause = () => {
    if (youtubeMode && ytPlayerRef.current) {
      const player = ytPlayerRef.current;
      const nowTime = player.getCurrentTime?.() || currentTime;
      suppressSyncRef.current = true;
      if (isPlaying) {
        player.pauseVideo?.();
        setIsPlaying(false);
        emitSyncAction('PAUSE', nowTime);
      } else {
        player.playVideo?.();
        setIsPlaying(true);
        emitSyncAction('PLAY', nowTime);
      }
      setTimeout(() => {
        suppressSyncRef.current = false;
      }, 500);
      return;
    }

    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
      emitSyncAction('PLAY', vid.currentTime);
    } else {
      vid.pause();
      setIsPlaying(false);
      emitSyncAction('PAUSE', vid.currentTime);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col justify-between bg-[#080A0E] vault-header-clearance vault-dock-clearance px-2.5 sm:px-6 select-none">
      {/* Compact Header & Mode Switch */}
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 pb-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Film className="h-4 w-4 text-rose-400 shrink-0" />
          <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
            {localFileName && mode === 'LOCAL_CAST' ? localFileName : 'Co-Watch'}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMode('LOCAL_CAST')}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              mode === 'LOCAL_CAST'
                ? 'bg-rose-600 text-white'
                : 'bg-white/10 text-zinc-300 hover:bg-white/15'
            }`}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setMode('YOUTUBE_SYNC')}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              mode === 'YOUTUBE_SYNC'
                ? 'bg-rose-600 text-white'
                : 'bg-white/10 text-zinc-300 hover:bg-white/15'
            }`}
          >
            YouTube
          </button>
        </div>
      </div>

      {/* Main Theater Viewport */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-2 min-h-0">
        <div className="relative aspect-video max-h-[38vh] sm:max-h-[46vh] w-full mx-auto overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl shrink-0">
          {mode === 'YOUTUBE_SYNC' ? (
            youtubeVideoId ? (
              <div ref={ytContainerRef} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center gap-2">
                <Link2 className="h-7 w-7 text-rose-400" />
                <p className="text-xs text-zinc-300">Paste a YouTube link below to watch in sync</p>
              </div>
            )
          ) : localFileUrl || remoteCastStream ? (
            <video
              ref={videoRef}
              src={localFileUrl || undefined}
              playsInline
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center gap-3">
              <Upload className="h-8 w-8 text-rose-400" />
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7B54] to-[#E11D48] px-4 py-2 text-xs font-semibold text-white shadow-lg">
                <Upload className="h-3.5 w-3.5" />
                Choose Video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleSelectMovieFile}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Shared Transport Control Bar (Works for both YouTube & Local Video) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-zinc-900/90 px-3 py-1.5 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7B54] to-[#E11D48] text-white shadow"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekByDelta(-10)}
              className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-white/20"
              title="Back 10s"
            >
              <RotateCcw className="h-3 w-3" />
              10s
            </button>

            <button
              type="button"
              onClick={() => seekByDelta(10)}
              className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-white/20"
              title="Forward 10s"
            >
              10s
              <RotateCw className="h-3 w-3" />
            </button>

            {isHost && (
              <button
                type="button"
                onClick={handleStartLiveCast}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30"
              >
                <Radio className="h-3 w-3" />
                Cast
              </button>
            )}
          </div>

          <div className="flex flex-1 min-w-[140px] items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={1}
              value={Math.min(currentTime, duration || 100)}
              onChange={handleScrub}
              className="flex-1 accent-rose-500 cursor-pointer h-1.5"
            />
            <span className="text-[11px] font-mono text-zinc-400">
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* YouTube URL Bar or Swap Video */}
        {mode === 'YOUTUBE_SYNC' ? (
          <form onSubmit={handleShareYoutubeUrl} className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              placeholder="Paste YouTube link..."
              className="flex-1 rounded-full border border-white/15 bg-zinc-900 px-4 py-2 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-rose-400"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shrink-0"
            >
              <Link2 className="h-3.5 w-3.5" />
              Load
            </button>
          </form>
        ) : (
          <div className="flex justify-center shrink-0">
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs text-zinc-200 transition-colors">
              <Upload className="h-3.5 w-3.5 text-rose-400" />
              {localFileUrl ? 'Change Video' : 'Select Local Video'}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleSelectMovieFile}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoWatchCinema;
