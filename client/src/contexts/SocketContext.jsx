import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { vaultToken, isUnlocked, registerPanicTeardown } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState('offline'); // 'online' | 'offline' | 'typing' | 'waiting'
  const [peerCount, setPeerCount] = useState(1);
  const [ripplePulse, setRipplePulse] = useState(null);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [arcadeInvite, setArcadeInvite] = useState(null);
  const [arcadeInviteReply, setArcadeInviteReply] = useState(null);
  const [pendingDuoLaunch, setPendingDuoLaunch] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callResponse, setCallResponse] = useState(null);
  const [callEndedTimestamp, setCallEndedTimestamp] = useState(0);
  const [chatReadEvent, setChatReadEvent] = useState(null);

  const socketRef = useRef(null);
  const offlineQueueRef = useRef([]);

  const triggerThinkingOfYou = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
    setRipplePulse(Date.now());
    if (socketRef.current?.connected) {
      socketRef.current.emit('interaction:thinking_of_you');
    }
  }, []);

  const sendEmojiReaction = useCallback((emoji) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    if (socketRef.current?.connected) {
      socketRef.current.emit('interaction:emoji', { emoji });
    } else {
      const item = {
        id: `${Date.now()}_${Math.random()}`,
        emoji,
        xOffset: Math.random() * 70 - 35,
      };
      setFloatingEmojis((prev) => [...prev.slice(-12), item]);
    }
  }, []);

  useEffect(() => {
    if (!isUnlocked || !vaultToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
      setPartnerStatus('offline');
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
    const sock = io(socketUrl, {
      auth: { token: vaultToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = sock;
    setSocket(sock);

    sock.on('connect', () => {
      setConnected(true);
      // Flush queued messages if any
      while (offlineQueueRef.current.length > 0) {
        const item = offlineQueueRef.current.shift();
        sock.emit(item.event, item.payload, item.ack);
      }
    });

    sock.on('disconnect', () => {
      setConnected(false);
    });

    sock.on('presence:status', (data) => {
      setPartnerStatus(data.partnerStatus || 'online');
      setPeerCount(data.peerCount || 1);
    });

    sock.on('interaction:thinking_of_you', () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
      setRipplePulse(Date.now());
    });

    sock.on('interaction:emoji', (data) => {
      const item = {
        id: data.id || `${Date.now()}_${Math.random()}`,
        emoji: data.emoji || '❤️',
        xOffset: Math.random() * 70 - 35,
      };
      setFloatingEmojis((prev) => [...prev.slice(-15), item]);
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== item.id));
      }, 2400);
    });

    sock.on('timeline:updated', () => {
      setTimelineVersion((v) => v + 1);
    });

    sock.on('arcade:invite', (invite) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
      setArcadeInvite(invite);
    });

    sock.on('arcade:invite_response', (reply) => {
      setArcadeInviteReply({ ...reply, id: Date.now() });
      if (reply.accepted) {
        setPendingDuoLaunch({ gameId: reply.gameId, ts: Date.now() });
      }
      setTimeout(() => {
        setArcadeInviteReply(null);
      }, 3600);
    });

    sock.on('call:incoming', (callData) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 80, 150, 80, 300]);
      }
      setIncomingCall(callData);
    });

    sock.on('call:response', (resp) => {
      setCallResponse({ ...resp, ts: Date.now() });
    });

    sock.on('call:ended', () => {
      setIncomingCall(null);
      setCallEndedTimestamp(Date.now());
    });

    sock.on('chat:read', (data) => {
      setChatReadEvent(data);
    });

    // Heartbeat interval every 20s
    const hb = setInterval(() => {
      if (sock.connected) {
        sock.emit('presence:heartbeat');
      }
    }, 20000);

    const unregisterPanic = registerPanicTeardown(() => {
      sock.disconnect();
      socketRef.current = null;
      setArcadeInvite(null);
      setArcadeInviteReply(null);
      setPendingDuoLaunch(null);
    });

    return () => {
      clearInterval(hb);
      unregisterPanic();
      sock.disconnect();
      socketRef.current = null;
    };
  }, [isUnlocked, vaultToken, registerPanicTeardown]);

  const emitWithOfflineQueue = useCallback((event, payload, ack) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, payload, ack);
      return true;
    }
    offlineQueueRef.current.push({ event, payload, ack });
    return false;
  }, []);

  const sendArcadeInvite = useCallback((gameId, gameTitle, onResult) => {
    if (!socketRef.current?.connected) {
      onResult?.({ success: false, partnerOnline: false });
      return false;
    }
    socketRef.current.emit('arcade:invite', { gameId, gameTitle }, (res) => {
      onResult?.(res || { success: true, partnerOnline: false });
    });
    return true;
  }, []);

  const respondToArcadeInvite = useCallback((accepted) => {
    setArcadeInvite((current) => {
      if (!current) return null;
      if (socketRef.current?.connected) {
        socketRef.current.emit('arcade:invite_response', {
          inviteId: current.inviteId,
          gameId: current.gameId,
          accepted,
        });
      }
      if (accepted) {
        setPendingDuoLaunch({ gameId: current.gameId, ts: Date.now() });
      }
      return null;
    });
  }, []);

  const clearPendingDuoLaunch = useCallback(() => {
    setPendingDuoLaunch(null);
  }, []);

  const clearArcadeInviteReply = useCallback(() => {
    setArcadeInviteReply(null);
  }, []);

  const sendCallRequest = useCallback((callType = 'video') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('call:request', { callType });
      return true;
    }
    return false;
  }, []);

  const respondToIncomingCall = useCallback((accepted, callType = 'video') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('call:response', { accepted, callType });
    }
    setIncomingCall(null);
  }, []);

  const endCallSignal = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('call:ended');
    }
    setCallResponse(null);
    setIncomingCall(null);
  }, []);

  const emitChatRead = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:read');
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        partnerStatus,
        peerCount,
        ripplePulse,
        floatingEmojis,
        timelineVersion,
        arcadeInvite,
        arcadeInviteReply,
        pendingDuoLaunch,
        incomingCall,
        callResponse,
        callEndedTimestamp,
        chatReadEvent,
        triggerThinkingOfYou,
        sendEmojiReaction,
        emitWithOfflineQueue,
        sendArcadeInvite,
        respondToArcadeInvite,
        clearPendingDuoLaunch,
        clearArcadeInviteReply,
        sendCallRequest,
        respondToIncomingCall,
        endCallSignal,
        emitChatRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

