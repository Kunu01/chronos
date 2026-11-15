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
  const iceCandidateQueueRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const callAnsweredRef = useRef(false);

  const stopAllMediaNow = useCallback(() => {
    pendingOfferRef.current = null;
    iceCandidateQueueRef.current = [];
    callAnsweredRef.current = false;

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
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        setRemoteStream((prev) => {
          const s = prev ? new MediaStream(prev.getTracks()) : new MediaStream();
          s.addTrack(event.track);
          return s;
        });
      }
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

  const drainIceCandidates = useCallback(async (pc) => {
    while (iceCandidateQueueRef.current.length > 0) {
      const cand = iceCandidateQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('ICE drain error:', err);
      }
    }
  }, []);

  const startCall = useCallback(
    async ({ video = true } = {}) => {
      try {
        setIceStatus('connecting');
        callAnsweredRef.current = false;
        pendingOfferRef.current = null;

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
      } catch (err) {
        console.error('startCall failed:', err);
        setCallActive(true);
        setCamOff(!video);
        setIceStatus('connected');
      }
    },
    [ensurePrimaryPeerConnection, facingMode, socket]
  );

  const acceptCall = useCallback(
    async ({ video = true } = {}) => {
      try {
        setIceStatus('connecting');
        callAnsweredRef.current = true;

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

        if (pendingOfferRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
          pendingOfferRef.current = null;
          await drainIceCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (socket) {
            socket.emit('webrtc:signal', { type: 'answer', sdp: pc.localDescription });
          }
        }
        setIceStatus('connected');
      } catch (err) {
        console.error('acceptCall failed:', err);
        setCallActive(true);
      }
    },
    [ensurePrimaryPeerConnection, facingMode, socket, drainIceCandidates]
  );

  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';

    // Critical for mobile: stop existing camera track first to release hardware lock
    if (currentVideoTrack) {
      currentVideoTrack.stop();
      localStreamRef.current.removeTrack(currentVideoTrack);
    }

    try {
      let nextCamStream;
      try {
        nextCamStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        nextCamStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      const newVideoTrack = nextCamStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      localStreamRef.current.addTrack(newVideoTrack);

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(
          (s) => (s.track && s.track.kind === 'video') || (s.track === null)
        );
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      setFacingMode(nextFacing);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setCamOff(false);
    } catch (err) {
      console.warn('flipCamera failed, restoring camera:', err);
      try {
        const restoreStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        const restoredTrack = restoreStream.getVideoTracks()[0];
        if (restoredTrack) {
          localStreamRef.current.addTrack(restoredTrack);
          if (pcRef.current) {
            const senders = pcRef.current.getSenders();
            const videoSender = senders.find(
              (s) => (s.track && s.track.kind === 'video') || (s.track === null)
            );
            if (videoSender) await videoSender.replaceTrack(restoredTrack);
          }
          setFacingMode('user');
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch {
        // Continue
      }
    }
  }, [facingMode]);

  // Signaling listeners for both Primary and Secondary Cinema PeerConnections
  useEffect(() => {
    if (!socket) return;

    const handlePrimarySignal = async (payload) => {
      try {
        const pc = ensurePrimaryPeerConnection();

        if (payload.type === 'offer') {
          if (callAnsweredRef.current && localStreamRef.current) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await drainIceCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:signal', { type: 'answer', sdp: pc.localDescription });
          } else {
            // Buffer offer until receiver taps Accept
            pendingOfferRef.current = payload.sdp;
          }
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await drainIceCandidates(pc);
        } else if (payload.type === 'ice-candidate' && payload.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } else {
            iceCandidateQueueRef.current.push(payload.candidate);
          }
        }
      } catch (err) {
        console.warn('Primary WebRTC signal error:', err);
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
  }, [socket, ensurePrimaryPeerConnection, ensureCinemaPeerConnection, drainIceCandidates]);

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
    acceptCall,
    flipCamera,
    stopAllMediaNow,
    toggleMic,
    toggleCam,
    switchToLowBandwidthAudio,
    attachLocalMovieStream,
  };
};
