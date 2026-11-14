import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const FloatingCallPiP = ({ webrtc, compactMode = false, onOpenFullScreen }) => {
  const {
    callActive,
    micMuted,
    camOff,
    localStream,
    remoteStream,
    stopAllMediaNow,
    toggleMic,
    toggleCam,
  } = webrtc;

  const [expanded, setExpanded] = useState(!compactMode);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!callActive) return null;

  return (
    <div
      className={`fixed z-30 right-3 sm:right-5 top-14 sm:top-16 transition-all duration-300 ${
        expanded ? 'w-44 sm:w-56' : 'w-28 sm:w-36'
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/85 shadow-2xl backdrop-blur-xl">
        <div
          className={`relative w-full bg-zinc-950 ${
            expanded ? 'aspect-[3/4]' : 'aspect-square'
          }`}
        >
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-9 w-9 rounded-full bg-rose-500/20 flex items-center justify-center animate-pulse">
                <Video className="h-4 w-4 text-rose-400" />
              </div>
            </div>
          )}

          {localStream && !camOff && (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute bottom-1.5 right-1.5 h-10 w-8 rounded-md border border-white/30 object-cover shadow-md scale-x-[-1]"
            />
          )}

          {/* Top Controls */}
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            {onOpenFullScreen && (
              <button
                type="button"
                onClick={onOpenFullScreen}
                className="rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                title="Open Full Screen Call"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="rounded-full bg-black/60 p-1.5 text-zinc-200 hover:bg-black/80"
              title={expanded ? 'Shrink PiP' : 'Expand PiP'}
            >
              <Minimize2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Control Bar */}
        <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-950/90">
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-full p-1.5 transition-colors ${
              micMuted ? 'bg-red-500/25 text-red-400' : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
            title={micMuted ? 'Unmute' : 'Mute'}
          >
            {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={toggleCam}
            className={`rounded-full p-1.5 transition-colors ${
              camOff ? 'bg-amber-500/25 text-amber-300' : 'bg-white/10 text-zinc-200 hover:bg-white/20'
            }`}
            title={camOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {camOff ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={stopAllMediaNow}
            className="rounded-full bg-red-600 hover:bg-red-500 p-1.5 text-white transition-colors"
            title="End call"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCallPiP;
