import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../utils/apiClient';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const MusicContext = createContext(null);

const DEFAULT_SOFT_TUNE = {
  _id: 'default_ambient_track_1',
  title: 'Warm Memories (Piano Ambient)',
  artist: 'Project Chronos Soft Tune',
  url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
  order: 0,
};

export const MusicProvider = ({ children }) => {
  const { isUnlocked } = useAuth();
  const { socket } = useSocket();

  const [playlist, setPlaylist] = useState([DEFAULT_SOFT_TUNE]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.45); // Soft comfortable background level

  const audioRef = useRef(null);
  const userInteractedRef = useRef(false);

  // Load tracks from server when vault is unlocked
  const loadPlaylist = useCallback(async () => {
    try {
      const data = await apiRequest('/memories/tracks');
      if (Array.isArray(data) && data.length > 0) {
        setPlaylist(data);
      }
    } catch {
      // Keep default soft tune fallback
    }
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      loadPlaylist();
    }
  }, [isUnlocked, loadPlaylist]);

  // Listen for real-time track updates from Admin Studio
  useEffect(() => {
    if (!socket) return;
    const handleUpdated = (track) => {
      setPlaylist((prev) => {
        const filtered = prev.filter((t) => t._id !== track._id);
        return [...filtered, track];
      });
    };
    const handleDeleted = ({ id }) => {
      setPlaylist((prev) => {
        const next = prev.filter((t) => t._id !== id);
        return next.length > 0 ? next : [DEFAULT_SOFT_TUNE];
      });
    };

    socket.on('music:updated', handleUpdated);
    socket.on('music:deleted', handleDeleted);

    return () => {
      socket.off('music:updated', handleUpdated);
      socket.off('music:deleted', handleDeleted);
    };
  }, [socket]);

  const currentTrack = playlist[currentTrackIndex] || playlist[0] || DEFAULT_SOFT_TUNE;

  // Initialize Audio Element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = volume;
    audioRef.current = audio;

    const handleEnded = () => {
      // Play next track in queue or loop back to first
      setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audioRef.current = null;
    };
  }, []);

  // Sync track URL change
  useEffect(() => {
    if (!audioRef.current || !currentTrack?.url) return;
    const audio = audioRef.current;
    const wasPlaying = isPlaying;
    audio.src = currentTrack.url;
    audio.load();

    if (wasPlaying || (isUnlocked && userInteractedRef.current)) {
      audio.play().catch(() => {
        // Autoplay policy: will start on next user tap
      });
    }
  }, [currentTrack?.url]);

  // Handle Autoplay on entering vault
  useEffect(() => {
    if (isUnlocked && audioRef.current && currentTrack?.url) {
      const audio = audioRef.current;
      audio.volume = volume;
      audio.muted = isMuted;

      const attemptAutoplay = () => {
        userInteractedRef.current = true;
        audio.play().then(() => setIsPlaying(true)).catch(() => {});
      };

      attemptAutoplay();

      const onUserGesture = () => {
        if (!userInteractedRef.current) {
          attemptAutoplay();
        }
        window.removeEventListener('click', onUserGesture);
        window.removeEventListener('touchstart', onUserGesture);
        window.removeEventListener('keydown', onUserGesture);
      };

      window.addEventListener('click', onUserGesture, { once: true });
      window.addEventListener('touchstart', onUserGesture, { once: true });
      window.addEventListener('keydown', onUserGesture, { once: true });

      return () => {
        window.removeEventListener('click', onUserGesture);
        window.removeEventListener('touchstart', onUserGesture);
        window.removeEventListener('keydown', onUserGesture);
      };
    } else if (!isUnlocked && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isUnlocked]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    userInteractedRef.current = true;
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const playNext = useCallback(() => {
    if (playlist.length <= 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  }, [playlist.length]);

  const playPrev = useCallback(() => {
    if (playlist.length <= 1) return;
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const setVolume = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  return (
    <MusicContext.Provider
      value={{
        playlist,
        currentTrack,
        currentTrackIndex,
        isPlaying,
        isMuted,
        volume,
        togglePlay,
        playNext,
        playPrev,
        toggleMute,
        setVolume,
        loadPlaylist,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    return {
      playlist: [],
      currentTrack: null,
      isPlaying: false,
      isMuted: false,
      volume: 0.5,
      togglePlay: () => {},
      playNext: () => {},
      playPrev: () => {},
      toggleMute: () => {},
      setVolume: () => {},
      loadPlaylist: () => {},
    };
  }
  return ctx;
};
