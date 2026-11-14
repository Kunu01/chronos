import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RefreshCw,
  Minimize2,
  Maximize,
  Minimize,
  Volume2,
  Heart,
} from 'lucide-react';

import { useSocket } from '../../contexts/SocketContext';

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const QUICK_REACTS = ['❤️', '😘', '🔥', '✨'];

const FullScreenCallView = ({
  webrtc,
  partnerRole = 'HER',
  onMinimize,
}) => {
  const {
    partnerStatus,
    sendEmojiReaction,
    sendCallRequest,
    callResponse,
    callEndedTimestamp,
    endCallSignal,
  } = useSocket();
  const partnerOnline = partnerStatus === 'online' || partnerStatus === 'typing';
  const {
    callActive,
    micMuted,
    camOff,
    facingMode,
    callSeconds,
    iceStatus,
    localStream,
    remoteStream,
    startCall,
    flipCamera,
    stopAllMediaNow,
    toggleMic,
    toggleCam,
    switchToLowBandwidthAudio,
  } = webrtc;

  const remoteVideoRef = useRef(null);
  const remoteVideoBgRef = useRef(null);
  const localVideoRef = useRef(null);
  const [floatingEmoji, setFloatingEmoji] = useState(null);
  const [fitMode, setFitMode] = useState('fit'); // 'fit' (uncropped wide angle) | 'fill' (cropped full screen)
  const [callStatusText, setCallStatusText] = useState('');

  useEffect(() => {
    if (!callResponse) return;
    if (callResponse.accepted === false) {
      setCallStatusText('Call Declined');
      setTimeout(() => {
        stopAllMediaNow();
        setCallStatusText('');
      }, 1600);
    }
  }, [callResponse, stopAllMediaNow]);

  useEffect(() => {
    if (callEndedTimestamp) {
      stopAllMediaNow();
    }
  }, [callEndedTimestamp, stopAllMediaNow]);

  const handleInitiateCall = (videoMode) => {
    setCallStatusText(`Calling ${partnerName}...`);
    sendCallRequest(videoMode ? 'video' : 'audio');
    startCall({ video: videoMode });
  };

  const handleEndCall = () => {
    endCallSignal();
    stopAllMediaNow();
    setCallStatusText('');
  };

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteVideoBgRef.current && remoteStream) {
      remoteVideoBgRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const sendReaction = (emoji) => {
    setFloatingEmoji(emoji);
    sendEmojiReaction(emoji);
    setTimeout(() => setFloatingEmoji(null), 1300);
  };

  const partnerName = partnerRole === 'HER' ? 'Her' : 'Him';

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#090B12] via-[#101420] to-[#08090D] flex flex-col items-center justify-between vault-header-clearance vault-dock-clearance px-3 sm:px-4 select-none touch-none">
      {/* Remote Video Container with Ambient Blurred Fill to avoid zoomed cropping */}
      {callActive && remoteStream ? (
        <div className="absolute inset-0 h-full w-full overflow-hidden flex items-center justify-center">
          {/* Ambient blurred backdrop fills screen edges naturally */}
          <video
            ref={remoteVideoBgRef}
            autoPlay
            playsInline
            muted
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-35 pointer-events-none"
          />
          {/* Main uncropped remote stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`relative h-full w-full ${
              fitMode === 'fill' ? 'object-cover' : 'object-contain'
            }`}
          />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        </div>
      )}

      {/* Subtle vignette for control contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none" />

      {/* Top Call Header */}
      <div className="relative z-10 w-full max-w-2xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-black/50 px-3.5 py-1.5 backdrop-blur-md">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              callActive
                ? 'bg-emerald-400 animate-pulse'
                : partnerOnline
                ? 'bg-emerald-400'
                : 'bg-zinc-500'
            }`}
          />
          <span className="text-sm font-semibold text-white">{partnerName}</span>
          <span className="text-xs text-zinc-300 font-mono">
            {callActive ? formatDuration(callSeconds) : iceStatus === 'connecting' ? '...' : 'Ready'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {callActive && (
            <button
              type="button"
              onClick={() => setFitMode((m) => (m === 'fit' ? 'fill' : 'fit'))}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-black/70 backdrop-blur-md transition-colors"
              title={fitMode === 'fit' ? 'Fill screen' : 'Fit natural wide view'}
            >
              {fitMode === 'fit' ? (
                <Maximize className="h-3.5 w-3.5 text-[#00F0FF]" />
              ) : (
                <Minimize className="h-3.5 w-3.5 text-rose-300" />
              )}
              <span className="text-[11px] font-semibold uppercase">{fitMode}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onMinimize}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-black/70 backdrop-blur-md transition-colors"
            title="Minimize call"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Minimize</span>
          </button>
        </div>
      </div>

      {/* Center Stage (Avatar orb when waiting / no remote video) */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1">
        {(!callActive || !remoteStream) && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-32 w-32 sm:h-40 sm:w-40 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-[#FF7B54]/30 to-[#E11D48]/30 shadow-2xl backdrop-blur-md">
              <Heart className="h-12 w-12 sm:h-14 sm:w-14 text-rose-300" />
              {callActive && (
                <span className="absolute -inset-3 rounded-full border border-rose-400/30 animate-ping" />
              )}
            </div>
            {callActive && !remoteStream && (
              <p className="font-mono text-xs uppercase tracking-widest text-rose-300 animate-pulse">
                {callStatusText || `Ringing ${partnerName}...`}
              </p>
            )}
            {!callActive && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => handleInitiateCall(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF7B54] to-[#E11D48] px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-rose-900/40 hover:opacity-95 transition-opacity active:scale-95"
                >
                  <Video className="h-4 w-4" />
                  Video Call
                </button>
                <button
                  type="button"
                  onClick={() => handleInitiateCall(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-colors active:scale-95"
                >
                  <Phone className="h-4 w-4" />
                  Audio
                </button>
              </div>
            )}
          </div>
        )}

        {floatingEmoji && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce drop-shadow-2xl">
            {floatingEmoji}
          </div>
        )}
      </div>

      {/* Self Preview Picture-in-Picture (Upper right corner, leaves bottom stage completely unobstructed) */}
      {callActive && localStream && !camOff && (
        <div className="absolute right-3 sm:right-5 top-20 sm:top-24 z-20 w-20 sm:w-28 aspect-[9/16] max-h-44 overflow-hidden rounded-2xl border border-white/25 bg-black shadow-2xl backdrop-blur-md">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />
        </div>
      )}

      {/* Bottom Controls */}
      {callActive && (
        <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-md">
          {/* Quick Reactions */}
          <div className="flex items-center gap-2">
            {QUICK_REACTS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => sendReaction(emoji)}
                className="h-9 w-9 rounded-full border border-white/15 bg-black/50 hover:bg-white/15 text-base transition-transform active:scale-90 backdrop-blur-md"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Primary Action Bar */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 rounded-full border border-white/15 bg-black/70 px-5 py-3 backdrop-blur-xl shadow-2xl">
            <button
              type="button"
              onClick={toggleMic}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                micMuted
                  ? 'bg-red-500/25 text-red-300 border border-red-400/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={micMuted ? 'Unmute' : 'Mute'}
            >
              {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={toggleCam}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                camOff
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={camOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>

            {!camOff && (
              <button
                type="button"
                onClick={flipCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                title="Switch camera"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={switchToLowBandwidthAudio}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors"
              title="Voice only"
            >
              <Volume2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleEndCall}
              className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/40 transition-colors"
              title="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullScreenCallView;
