import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gamepad2, X, MessageCircle, Phone, PhoneOff, Video } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAlibi } from '../../hooks/useAlibi';
import DynamicIsland from './DynamicIsland';
import FloatingGlassDock from './FloatingGlassDock';
import FloatingCallPiP from '../webrtc/FloatingCallPiP';
import FullScreenCallView from '../webrtc/FullScreenCallView';
import TrainTimelineCanvas from '../3d-train/TrainTimelineCanvas';
import EphemeralChat from '../chat/EphemeralChat';
import CoWatchCinema from '../cinema/CoWatchCinema';
import ArcadeRoom from '../arcade/ArcadeRoom';
import VaultMusicPlayer from './VaultMusicPlayer';

const VaultLayout = () => {
  const { role, savepointMeta, updateSavepointState } = useAuth();
  const { setTheme } = useTheme();
  const {
    socket,
    ripplePulse,
    floatingEmojis,
    arcadeInvite,
    arcadeInviteReply,
    respondToArcadeInvite,
    clearArcadeInviteReply,
    incomingCall,
    respondToIncomingCall,
  } = useSocket();
  const webrtc = useWebRTC();
  const { triggerManualPanic } = useAlibi();

  const initialTab = savepointMeta?.activeTab || 'train';
  const [activeTab, setActiveTab] = useState(initialTab);
  const lastNonCallTabRef = useRef(initialTab === 'call' ? 'train' : initialTab);
  const [showPulseOverlay, setShowPulseOverlay] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatToast, setChatToast] = useState(null);

  const isHer = role === 'PARTNER_HER' || role === 'HER';
  const partnerRole = isHer ? 'HIM' : 'HER';

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  useEffect(() => {
    if (!ripplePulse) return undefined;
    setShowPulseOverlay(true);
    const t = setTimeout(() => setShowPulseOverlay(false), 1800);
    return () => clearTimeout(t);
  }, [ripplePulse]);

  // Unread chat notification tracking when outside the chat tab
  useEffect(() => {
    if (!socket) return;
    const handleIncomingChat = (msg) => {
      if (msg?.senderRole && msg.senderRole !== role) {
        if (activeTab !== 'chat') {
          setUnreadChatCount((c) => c + 1);
          setChatToast({
            id: Date.now(),
            text: msg.type === 'audio' ? '🎤 Voice message' : msg.content,
          });
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([30, 40]);
          }
          setTimeout(() => setChatToast(null), 4500);
        }
      }
    };
    socket.on('chat:receive', handleIncomingChat);
    return () => socket.off('chat:receive', handleIncomingChat);
  }, [socket, role, activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') {
      setUnreadChatCount(0);
      setChatToast(null);
    }
  }, [activeTab]);

  const handleChangeTab = useCallback(
    (nextTab) => {
      if (nextTab !== 'call') {
        lastNonCallTabRef.current = nextTab;
      }
      setActiveTab(nextTab);
      updateSavepointState({ activeTab: nextTab });
    },
    [updateSavepointState]
  );

  const handleTrainProgressChange = useCallback(
    (progress) => {
      updateSavepointState({ trainProgress: progress });
    },
    [updateSavepointState]
  );

  const handleAcceptInvite = () => {
    respondToArcadeInvite(true);
    handleChangeTab('arcade');
  };

  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden bg-[#0A0C10] text-zinc-100 select-none">
      <DynamicIsland
        partnerRole={partnerRole}
        onTriggerPanic={triggerManualPanic}
      />

      {/* Incoming Thinking-Of-You Pulse Overlay */}
      {showPulseOverlay && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-bounce text-6xl drop-shadow-[0_0_24px_rgba(244,63,94,0.85)]">
            ❤️
          </div>
        </div>
      )}

      {/* Floating Emoji Reactions */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {floatingEmojis.map((item) => (
          <div
            key={item.id}
            style={{ left: `calc(50% + ${item.xOffset}px)` }}
            className="absolute bottom-24 text-3xl animate-bounce"
          >
            {item.emoji}
          </div>
        ))}
      </div>

      {/* Partner Game Invite Toast */}
      {arcadeInvite && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-400/35 bg-black/90 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 className="h-4 w-4 text-amber-300 shrink-0" />
              <p className="text-xs font-semibold text-white truncate">
                {arcadeInvite.fromLabel || (partnerRole === 'HER' ? 'Her' : 'Him')} invited you to{' '}
                {arcadeInvite.gameTitle || 'Arcade'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAcceptInvite}
                className="rounded-full bg-gradient-to-r from-[#FF7B54] to-[#E11D48] px-3 py-1 text-[11px] font-semibold text-white"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => respondToArcadeInvite(false)}
                className="rounded-full bg-white/10 p-1 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partner Invite Reply Banner */}
      {arcadeInviteReply && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-xs">
          <div className="flex items-center justify-between gap-2 rounded-full border border-white/15 bg-black/90 px-4 py-2 text-xs text-white shadow-xl backdrop-blur-xl">
            <span className="truncate">
              {arcadeInviteReply.accepted ? 'Duo starting...' : 'Invite declined'}
            </span>
            <button
              type="button"
              onClick={clearArcadeInviteReply}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Unread Incoming Chat Message Pop (when outside Chat tab) */}
      {chatToast && (
        <div
          onClick={() => {
            handleChangeTab('chat');
            setChatToast(null);
          }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/50 bg-[#101c18]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl hover:border-emerald-400 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  {partnerRole === 'HER' ? 'Her' : 'Him'}
                </p>
                <p className="text-[11px] text-zinc-300 truncate">{chatToast.text}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/25 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              Reply
            </span>
          </div>
        </div>
      )}

      {/* Real In-App Incoming Call Modal (Ring with Video / Audio Accept & Decline) */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-rose-500/30 bg-gradient-to-b from-[#181a24] to-[#0c0d14] p-6 text-center shadow-2xl">
            <div className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7B54] to-[#E11D48] text-white shadow-xl shadow-rose-900/50">
              <span className="text-3xl font-bold">{partnerRole === 'HER' ? 'H' : 'H'}</span>
              <span className="absolute -inset-2 rounded-full border-2 border-rose-400/50 animate-ping" />
            </div>

            <h3 className="text-xl font-bold text-white">
              {incomingCall.callerName || (partnerRole === 'HER' ? 'Her' : 'Him')}
            </h3>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-rose-300 animate-pulse">
              {incomingCall.callType === 'video' ? 'Incoming Video Call...' : 'Incoming Audio Call...'}
            </p>

            <div className="mt-8 flex w-full items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => respondToIncomingCall(false)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/40 hover:bg-red-500 active:scale-90 transition-all"
                title="Decline"
              >
                <PhoneOff className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  const callType = incomingCall.callType || 'video';
                  respondToIncomingCall(true, callType);
                  handleChangeTab('call');
                  await webrtc.acceptCall({ video: callType === 'video' });
                }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-400 active:scale-90 transition-all"
                title="Accept"
              >
                {incomingCall.callType === 'video' ? (
                  <Video className="h-6 w-6" />
                ) : (
                  <Phone className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="h-full w-full overflow-hidden">
        {activeTab === 'train' && (
          <TrainTimelineCanvas
            initialProgress={savepointMeta?.trainProgress}
            onProgressChange={handleTrainProgressChange}
          />
        )}
        {activeTab === 'chat' && <EphemeralChat partnerRole={partnerRole} />}
        {activeTab === 'cinema' && <CoWatchCinema webrtc={webrtc} />}
        {activeTab === 'call' && (
          <FullScreenCallView
            webrtc={webrtc}
            partnerRole={partnerRole}
            onMinimize={() => handleChangeTab(lastNonCallTabRef.current || 'train')}
          />
        )}
        {activeTab === 'arcade' && <ArcadeRoom />}
      </main>

      {/* Floating PiP (only shown during active call when outside the Call tab) */}
      {webrtc.callActive && activeTab !== 'call' && (
        <FloatingCallPiP
          webrtc={webrtc}
          compactMode={true}
          onOpenFullScreen={() => handleChangeTab('call')}
        />
      )}

      {/* Central Ambient Music System */}
      <VaultMusicPlayer />

      <FloatingGlassDock
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        callActive={webrtc.callActive}
        unreadChatCount={unreadChatCount}
      />
    </div>
  );
};

export default VaultLayout;
