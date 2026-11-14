import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const buildIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const username = import.meta.env.VITE_TURN_USERNAME;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && username && credential && !username.includes('your_')) {
    servers.push({
      urls: turnUrl,
      username,
      credential,
    });
  }
  return servers;
};

/**
 * FEAT-COM-01 & Resolution 6 Dual-Connection WebRTC Strategy:
 * 1. Primary RTCPeerConnection (`pcRef`) strictly for persistent PiP Video/Audio Call (`webrtc:signal`).
 * 2. Secondary RTCPeerConnection (`cinemaPcRef`) strictly for Cinema `captureStream()` (`webrtc:cinema_signal`).
 *    If iOS Safari fails codec negotiation on the secondary connection, triggers `cinema:sync_fallback` (YouTube URL Sync).
 */
export const useWebRTC = () => {
  const { socket } = useSocket();
  const { registerPanicTeardown } = useAuth();

  const [callActive, setCallActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [callSeconds, setCallSeconds] = useState(0);
  const [iceStatus, setIceStatus] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteCastStream, setRemoteCastStream] = useState(null);
  const [cinemaFallbackTriggered, setCinemaFallbackTriggered] = useState(false);

  const pcRef = useRef(null);
  const cinemaPcRef = useRef(null);
  const localStreamRef = useRef(null);
  const castTracksRef = useRef([]);

  const stopAllMediaNow = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    castTracksRef.current.forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
    castTracksRef.current = [];

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (cinemaPcRef.current) {
      cinemaPcRef.current.close();
      cinemaPcRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteCastStream(null);
    setCallActive(false);
    setCamOff(false);
    setMicMuted(false);
    setCallSeconds(0);
    setIceStatus('idle');
  }, []);

  useEffect(() => {
    if (!callActive) return;
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [callActive]);

  useEffect(() => {
    return registerPanicTeardown(stopAllMediaNow);
  }, [registerPanicTeardown, stopAllMediaNow]);

  // 1. Primary Camera RTCPeerConnection
  const ensurePrimaryPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) setRemoteStream(stream);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setIceStatus('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        setIceStatus('reconnecting');
        if (typeof pc.restartIce === 'function') {
          pc.restartIce();
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket]);

  // 2. Resolution 6: Secondary Dedicated Cinema RTCPeerConnection
  const ensureCinemaPeerConnection = useCallback(() => {
    if (cinemaPcRef.current) return cinemaPcRef.current;

    const cpc = new RTCPeerConnection({ iceServers: buildIceServers() });

    cpc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:cinema_signal', {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    cpc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteCastStream(stream);
        setCinemaFallbackTriggered(false);
      }
    };

    // Resolution 6: Catch iOS Safari codec/ICE negotiation failure and fallback to YouTube URL Sync
    cpc.oniceconnectionstatechange = () => {
      const state = cpc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        setCinemaFallbackTriggered(true);
        if (socket) {
          socket.emit('cinema:sync_fallback', {
            reason: 'iOS Safari Secondary RTCPeerConnection codec negotiation fallback',
            youtubeUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
          });
        }
      }
    };

    cinemaPcRef.current = cpc;
    return cpc;
  }, [socket]);

  const startCall = useCallback(
    async ({ video = true } = {}) => {
      try {
        setIceStatus('connecting');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video
            ? {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
          audio: true,
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        setCamOff(!video);
        setMicMuted(false);
        setCallActive(true);

        const pc = ensurePrimaryPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (socket) {
          socket.emit('webrtc:signal', { type: 'offer', sdp: pc.localDescription });
        }
        setIceStatus('connected');
      } catch {
        setCallActive(true);
        setCamOff(!video);
        setIceStatus('connected');
      }
    },
    [ensurePrimaryPeerConnection, facingMode, socket]
  );

  const flipCamera = useCallback(async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);

    if (!localStreamRef.current) return;
    try {
      const nextCamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const newVideoTrack = nextCamStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const oldTracks = localStreamRef.current.getVideoTracks();
      oldTracks.forEach((t) => {
        localStreamRef.current.removeTrack(t);
        t.stop();
      });
      localStreamRef.current.addTrack(newVideoTrack);

      if (pcRef.current) {
        const sender = pcRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setCamOff(false);
    } catch {
      // Fallback if single-camera device ignores exact facingMode
    }
  }, [facingMode]);

  // Signaling listeners for both Primary and Secondary Cinema PeerConnections
  useEffect(() => {
    if (!socket) return;

    const handlePrimarySignal = async (payload) => {
      try {
        const pc = ensurePrimaryPeerConnection();
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:signal', { type: 'answer', sdp: pc.localDescription });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice-candidate' && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        // Ignore transient primary signaling errors
      }
    };

    const handleCinemaSignal = async (payload) => {
      try {
        const cpc = ensureCinemaPeerConnection();
        if (payload.type === 'offer') {
          await cpc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await cpc.createAnswer();
          await cpc.setLocalDescription(answer);
          socket.emit('webrtc:cinema_signal', { type: 'answer', sdp: cpc.localDescription });
        } else if (payload.type === 'answer') {
          await cpc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice-candidate' && payload.candidate) {
          await cpc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        // Resolution 6: Negotiation failed (e.g. unsupported Android MP4 codec on iOS Safari) -> trigger YouTube fallback
        setCinemaFallbackTriggered(true);
        socket.emit('cinema:sync_fallback', {
          reason: 'Secondary Cinema SDP negotiation failed on iOS Safari',
          youtubeUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
        });
      }
    };

    socket.on('webrtc:signal', handlePrimarySignal);
    socket.on('webrtc:cinema_signal', handleCinemaSignal);
    return () => {
      socket.off('webrtc:signal', handlePrimarySignal);
      socket.off('webrtc:cinema_signal', handleCinemaSignal);
    };
  }, [socket, ensurePrimaryPeerConnection, ensureCinemaPeerConnection]);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setMicMuted((m) => !m);
  }, []);

  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setCamOff((c) => !c);
  }, []);

  const switchToLowBandwidthAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
    }
    setCamOff(true);
    setIceStatus('low-bandwidth');
  }, []);

  /**
   * Resolution 6: Attaches local Android .mp4 stream via Secondary RTCPeerConnection
   */
  const attachLocalMovieStream = useCallback(
    async (videoElement) => {
      if (!videoElement) return false;
      const captureFn = videoElement.captureStream || videoElement.mozCaptureStream;
      if (typeof captureFn !== 'function') {
        setCinemaFallbackTriggered(true);
        if (socket) {
          socket.emit('cinema:sync_fallback', {
            reason: 'captureStream() not supported on this device browser',
            youtubeUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
          });
        }
        return false;
      }

      try {
        if (cinemaPcRef.current) {
          cinemaPcRef.current.close();
          cinemaPcRef.current = null;
        }
        const movieStream = captureFn.call(videoElement);
        const cpc = ensureCinemaPeerConnection();
        movieStream.getTracks().forEach((track) => {
          castTracksRef.current.push(track);
          cpc.addTrack(track, movieStream);
        });

        const offer = await cpc.createOffer();
        await cpc.setLocalDescription(offer);
        if (socket) {
          socket.emit('webrtc:cinema_signal', {
            type: 'offer',
            sdp: cpc.localDescription,
          });
        }
        return true;
      } catch {
        setCinemaFallbackTriggered(true);
        if (socket) {
          socket.emit('cinema:sync_fallback', {
            reason: 'Secondary RTCPeerConnection captureStream failed',
            youtubeUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk',
          });
        }
        return false;
      }
    },
    [ensureCinemaPeerConnection, socket]
  );

  return {
    callActive,
    micMuted,
    camOff,
    facingMode,
    callSeconds,
    iceStatus,
    localStream,
    remoteStream,
    remoteCastStream,
    cinemaFallbackTriggered,
    setCinemaFallbackTriggered,
    startCall,
    flipCamera,
    stopAllMediaNow,
    toggleMic,
    toggleCam,
    switchToLowBandwidthAudio,
    attachLocalMovieStream,
  };
};
