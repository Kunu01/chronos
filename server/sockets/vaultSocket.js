import { verifyVaultTokenString } from '../middlewares/authMiddleware.js';
import { addChatMessage, markChatMessagesRead, recordActivity } from '../services/dataStore.js';
import { sanitizeObject } from '../middlewares/sanitize.js';

const VAULT_ROOM = 'chronos_vault';
const MAX_VAULT_PEERS = 2;

const activePeers = new Map();
let pendingArcadeInvite = null;

export const setupVaultSockets = (io) => {
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('UNAUTHORIZED_SOCKET'));
    }

    try {
      const decoded = verifyVaultTokenString(token);
      socket.userRole = decoded.role;
      next();
    } catch {
      return next(new Error('INVALID_SOCKET_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    const room = io.sockets.adapter.rooms.get(VAULT_ROOM);
    const currentCount = room ? room.size : 0;

    if (currentCount >= MAX_VAULT_PEERS) {
      for (const [existingId, peer] of activePeers.entries()) {
        if (peer.role === socket.userRole && existingId !== socket.id) {
          const oldSock = io.sockets.sockets.get(existingId);
          if (oldSock) {
            oldSock.leave(VAULT_ROOM);
            oldSock.disconnect(true);
          }
          activePeers.delete(existingId);
          break;
        }
      }
    }

    const updatedRoom = io.sockets.adapter.rooms.get(VAULT_ROOM);
    if (updatedRoom && updatedRoom.size >= MAX_VAULT_PEERS) {
      socket.emit('vault:full', {
        message: 'Chronos Vault is strictly limited to 2 concurrent connections.',
      });
      socket.disconnect(true);
      return;
    }

    socket.join(VAULT_ROOM);
    activePeers.set(socket.id, {
      role: socket.userRole,
      lastHeartbeat: Date.now(),
    });

    const broadcastPresence = (extraStatus = null) => {
      const rolesOnline = Array.from(activePeers.values()).map((p) => p.role);
      io.to(VAULT_ROOM).emit('presence:status', {
        partnerStatus: extraStatus || (activePeers.size > 1 ? 'online' : 'waiting'),
        onlineRoles: rolesOnline,
        peerCount: activePeers.size,
      });
    };

    broadcastPresence();

    // Deliver a fresh (<90s) pending game invite if partner just joined
    if (
      pendingArcadeInvite &&
      pendingArcadeInvite.fromRole !== socket.userRole &&
      Date.now() - pendingArcadeInvite.timestamp < 90_000
    ) {
      socket.emit('arcade:invite', pendingArcadeInvite);
    }

    // 1. Ephemeral 24h Chat Message
    socket.on('chat:send', async (payload, ack) => {
      try {
        const clean = sanitizeObject(payload || {});
        const type = clean.type === 'audio' ? 'audio' : 'text';
        const content = String(clean.content || '').trim().slice(0, 1000);
        if (!content) return;

        const saved = await addChatMessage({
          senderRole: socket.userRole,
          type,
          content,
        });

        const outbound = {
          ...(saved.toObject ? saved.toObject() : saved),
          clientTempId: clean.clientTempId ? String(clean.clientTempId).slice(0, 64) : null,
        };

        io.to(VAULT_ROOM).emit('chat:receive', outbound);
        if (typeof ack === 'function') ack({ success: true, message: outbound });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    socket.on('chat:read', async () => {
      try {
        await markChatMessagesRead(socket.userRole);
        socket.to(VAULT_ROOM).emit('chat:read', {
          readerRole: socket.userRole,
          readAt: Date.now(),
        });
      } catch {
        // ignore
      }
    });

    // 2. Typing & Heartbeat Presence
    socket.on('presence:heartbeat', () => {
      const peer = activePeers.get(socket.id);
      if (peer) peer.lastHeartbeat = Date.now();
      broadcastPresence();
    });

    socket.on('presence:typing', ({ isTyping } = {}) => {
      socket.to(VAULT_ROOM).emit('presence:status', {
        partnerStatus: isTyping ? 'typing' : 'online',
        actor: socket.userRole,
        onlineRoles: Array.from(activePeers.values()).map((p) => p.role),
        peerCount: activePeers.size,
      });
    });

    // 3. Co-Watch Cinema Sync (<150ms drift control) & Resolution 6 YouTube Sync Fallback
    socket.on('cinema:control', (payload) => {
      const clean = sanitizeObject(payload || {});
      socket.to(VAULT_ROOM).emit('cinema:control', {
        action: clean.action,
        timestamp: Number(clean.timestamp || 0),
        sentAt: Date.now(),
        actor: socket.userRole,
        mediaTitle: clean.mediaTitle || null,
        streamMode: clean.streamMode || null,
      });
      if (clean.action === 'start_cast') {
        recordActivity(socket.userRole, 'Started Co-Watch Cinema session');
      }
    });

    socket.on('cinema:sync_fallback', (payload) => {
      const clean = sanitizeObject(payload || {});
      io.to(VAULT_ROOM).emit('cinema:sync_fallback', {
        youtubeUrl: clean.youtubeUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        reason: clean.reason || 'iOS Safari WebRTC codec fallback triggered',
        timestamp: Number(clean.timestamp || 0),
        actor: socket.userRole,
      });
      recordActivity(socket.userRole, 'Triggered Cinema YouTube URL Sync Fallback');
    });

    // 4. Resolution 7: High-Frequency Arcade Telemetry & Reliable Turn/Invite Events
    socket.on('game:update', (payload) => {
      socket.volatile.to(VAULT_ROOM).emit('game:update', {
        gameId: payload?.gameId,
        player: socket.userRole === 'PARTNER_HER' ? 'HER' : 'HIM',
        authoritative: socket.userRole === 'PARTNER_HIM',
        x: Number(payload?.x || 0),
        y: Number(payload?.y || 0),
        puckX: payload?.puckX,
        puckY: payload?.puckY,
        puckVx: payload?.puckVx,
        puckVy: payload?.puckVy,
        scoreHer: payload?.scoreHer,
        scoreHim: payload?.scoreHim,
        boostTap: Boolean(payload?.boostTap),
      });
    });

    socket.on('arcade:invite', (payload, ack) => {
      const clean = sanitizeObject(payload || {});
      const invite = {
        inviteId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gameId: String(clean.gameId || 'air-hockey').slice(0, 40),
        gameTitle: String(clean.gameTitle || 'Arcade Game').slice(0, 60),
        fromRole: socket.userRole,
        fromLabel: socket.userRole === 'PARTNER_HER' ? 'HER' : 'HIM',
        timestamp: Date.now(),
      };
      pendingArcadeInvite = invite;
      socket.to(VAULT_ROOM).emit('arcade:invite', invite);
      if (typeof ack === 'function') {
        ack({
          success: true,
          inviteId: invite.inviteId,
          partnerOnline: activePeers.size >= 2,
        });
      }
    });

    socket.on('arcade:invite_response', (payload) => {
      const clean = sanitizeObject(payload || {});
      if (pendingArcadeInvite && pendingArcadeInvite.inviteId === clean.inviteId) {
        pendingArcadeInvite = null;
      }
      socket.to(VAULT_ROOM).emit('arcade:invite_response', {
        inviteId: String(clean.inviteId || ''),
        gameId: String(clean.gameId || 'air-hockey').slice(0, 40),
        accepted: Boolean(clean.accepted),
        fromRole: socket.userRole,
        fromLabel: socket.userRole === 'PARTNER_HER' ? 'HER' : 'HIM',
      });
    });

    socket.on('arcade:event', (payload) => {
      const clean = sanitizeObject(payload || {});
      socket.to(VAULT_ROOM).emit('arcade:event', {
        ...clean,
        fromRole: socket.userRole,
        fromLabel: socket.userRole === 'PARTNER_HER' ? 'HER' : 'HIM',
      });
    });

    // 5. "Thinking of You" Haptic & Water Ripple Pulse
    socket.on('interaction:thinking_of_you', () => {
      io.to(VAULT_ROOM).emit('interaction:thinking_of_you', {
        from: socket.userRole,
        timestamp: Date.now(),
      });
      recordActivity(socket.userRole, 'Sent "Thinking of You" haptic ripple');
    });

    // 6. IG-Live Floating Physics Emoji Reactions
    socket.on('interaction:emoji', ({ emoji } = {}) => {
      const allowed = ['❤️', '🔥', '🥹', '✨', '⚡', '🍿'];
      const safeEmoji = allowed.includes(emoji) ? emoji : '❤️';
      io.to(VAULT_ROOM).emit('interaction:emoji', {
        emoji: safeEmoji,
        from: socket.userRole,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      });
    });

    // 7. Call Invitations & Lifecycle
    socket.on('call:request', (payload) => {
      const clean = sanitizeObject(payload || {});
      socket.to(VAULT_ROOM).emit('call:incoming', {
        callType: clean.callType === 'audio' ? 'audio' : 'video',
        callerRole: socket.userRole,
        callerName: socket.userRole === 'PARTNER_HER' ? 'Her' : 'Him',
        timestamp: Date.now(),
      });
      recordActivity(socket.userRole, `Initiated ${clean.callType || 'video'} call`);
    });

    socket.on('call:response', (payload) => {
      const clean = sanitizeObject(payload || {});
      socket.to(VAULT_ROOM).emit('call:response', {
        accepted: Boolean(clean.accepted),
        callType: clean.callType === 'audio' ? 'audio' : 'video',
        responderRole: socket.userRole,
      });
    });

    socket.on('call:ended', () => {
      socket.to(VAULT_ROOM).emit('call:ended', {
        fromRole: socket.userRole,
      });
    });

    // 8. Primary Camera WebRTC P2P Signaling
    socket.on('webrtc:signal', (payload) => {
      socket.to(VAULT_ROOM).emit('webrtc:signal', {
        ...payload,
        from: socket.userRole,
      });
    });

    // 9. Resolution 6: Secondary Dedicated Cinema RTCPeerConnection Signaling
    socket.on('webrtc:cinema_signal', (payload) => {
      socket.to(VAULT_ROOM).emit('webrtc:cinema_signal', {
        ...payload,
        from: socket.userRole,
      });
    });

    socket.on('disconnect', () => {
      activePeers.delete(socket.id);
      if (pendingArcadeInvite?.fromRole === socket.userRole) {
        pendingArcadeInvite = null;
      }
      io.to(VAULT_ROOM).emit('presence:status', {
        partnerStatus: activePeers.size >= 2 ? 'online' : 'offline',
        onlineRoles: Array.from(activePeers.values()).map((p) => p.role),
        peerCount: activePeers.size,
      });
    });
  });
};
