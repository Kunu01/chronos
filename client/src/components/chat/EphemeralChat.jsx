import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Mic,
  Square,
  Play,
  Pause,
  Check,
  CheckCheck,
  Clock,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { apiRequest } from '../../utils/apiClient';

const formatTime = (dateValue) => {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const EphemeralChat = ({ partnerRole = 'HER' }) => {
  const { vaultToken, role } = useAuth();
  const { socket, partnerStatus, emitChatRead, chatReadEvent } = useSocket();

  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  const listEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeAudioRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!vaultToken) return;
    let active = true;
    apiRequest('/chat/messages', { token: vaultToken })
      .then((res) => {
        if (active && Array.isArray(res)) {
          setMessages(res);
          emitChatRead();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [vaultToken, emitChatRead]);

  // When partner reads messages, mark all my sent messages as read (Blue Ticks)
  useEffect(() => {
    if (!chatReadEvent) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.senderRole === role ? { ...m, isRead: true } : m
      )
    );
  }, [chatReadEvent, role]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (msg) => {
      if (!msg) return;
      setMessages((prev) => {
        const matchIdx = prev.findIndex(
          (m) =>
            (m._id && msg._id && String(m._id) === String(msg._id)) ||
            (msg.clientTempId &&
              (m._id === msg.clientTempId || m.clientTempId === msg.clientTempId))
        );
        if (matchIdx !== -1) {
          const next = [...prev];
          next[matchIdx] = msg;
          return next;
        }
        return [...prev, msg];
      });
      // Acknowledge read immediately since chat is currently active
      emitChatRead();
    };

    const handleTyping = (payload) => {
      if (payload?.role && payload.role !== role) {
        setPartnerTyping(Boolean(payload.isTyping));
      }
    };

    socket.on('chat:receive', handleIncoming);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:receive', handleIncoming);
      socket.off('chat:typing', handleTyping);
    };
  }, [socket, role]);

  const emitTypingState = (isTyping) => {
    if (!socket) return;
    socket.emit('chat:typing', { isTyping });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setTextInput(val);
    emitTypingState(val.trim().length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingState(false), 1600);
  };

  const upsertSavedFromAck = (clientTempId, ack) => {
    const saved = ack?.message || ack?.data;
    if (!ack?.ok && !ack?.success) return;
    if (!saved) return;

    setMessages((prev) => {
      const existsIdx = prev.findIndex(
        (m) =>
          (m._id && saved._id && String(m._id) === String(saved._id)) ||
          m._id === clientTempId ||
          m.clientTempId === clientTempId
      );
      if (existsIdx !== -1) {
        const next = [...prev];
        next[existsIdx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  const handleSendText = (e) => {
    e?.preventDefault?.();
    const content = textInput.trim();
    if (!content) return;

    const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic = {
      _id: clientTempId,
      clientTempId,
      senderRole: role || 'PARTNER_HIM',
      type: 'text',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setTextInput('');
    emitTypingState(false);

    if (socket) {
      socket.emit(
        'chat:send',
        { type: 'text', content, clientTempId },
        (ack) => upsertSavedFromAck(clientTempId, ack)
      );
    }
  };

  const startVoiceRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());

        const clientTempId = `tmp_v_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        const blobUrl = URL.createObjectURL(blob);
        const optimistic = {
          _id: clientTempId,
          clientTempId,
          senderRole: role || 'PARTNER_HIM',
          type: 'audio',
          content: blobUrl,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
          const fd = new FormData();
          fd.append('audio', blob, 'voice-note.webm');
          const saved = await apiRequest('/chat/upload-audio', {
            method: 'POST',
            body: fd,
            token: vaultToken,
            isFormData: true,
          });
          upsertSavedFromAck(clientTempId, { ok: true, message: saved });
        } catch {
          // fallback over socket if upload failed
          const reader = new FileReader();
          reader.onloadend = () => {
            if (socket) {
              socket.emit(
                'chat:send',
                { type: 'audio', content: reader.result, clientTempId },
                (ack) => upsertSavedFromAck(clientTempId, ack)
              );
            }
          };
          reader.readAsDataURL(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setRecording(false);
    }
  };

  const stopVoiceRecord = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setRecordSeconds(0);
  };

  const togglePlayVoice = (msg) => {
    if (playingAudioId === msg._id) {
      activeAudioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    const audio = new Audio(msg.content);
    activeAudioRef.current = audio;
    audio.onended = () => setPlayingAudioId(null);
    audio.play().catch(() => setPlayingAudioId(null));
    setPlayingAudioId(msg._id);
  };

  const partnerName = partnerRole === 'HER' ? 'Her' : 'Him';
  const isOnline = partnerStatus === 'online' || partnerStatus === 'typing';

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col bg-[#0B141A] vault-header-clearance vault-dock-clearance select-none">
      {/* Compact WhatsApp-style Top Bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-white/10 bg-[#1F2C34] px-3 sm:px-6 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7B54] to-[#E11D48] text-xs font-bold text-white shadow">
            {partnerName[0]}
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#1F2C34] ${
                isOnline ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-100">{partnerName}</p>
            <p className="text-[11px] text-emerald-300/90">
              {partnerTyping || partnerStatus === 'typing'
                ? 'typing...'
                : isOnline
                ? 'online'
                : 'last seen recently'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-medium text-zinc-300">
          <Clock className="h-3 w-3 text-emerald-400" />
          <span>24h</span>
        </div>
      </div>

      {/* WhatsApp Message Stream */}
      <div className="wa-chat-bg no-scrollbar flex-1 overflow-y-auto px-3 sm:px-6 py-3 space-y-2">
        <div className="flex justify-center my-1">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#182229]/90 px-2.5 py-1 text-[10px] font-medium text-zinc-300 shadow">
            <Lock className="h-2.5 w-2.5 text-emerald-400" />
            Today • Auto-clears in 24h
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderRole === role;
          const isVoice = msg.type === 'audio' || msg.messageType === 'voice';

          return (
            <div
              key={msg._id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`relative max-w-[82%] sm:max-w-[68%] px-3 py-1.5 shadow-sm ${
                  isMe
                    ? 'rounded-2xl rounded-tr-sm bg-[#005C4B] text-white'
                    : 'rounded-2xl rounded-tl-sm bg-[#202C33] text-zinc-100'
                }`}
              >
                {isVoice ? (
                  <div className="flex items-center gap-2.5 py-1 pr-2 min-w-[160px]">
                    <button
                      type="button"
                      onClick={() => togglePlayVoice(msg)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                    >
                      {playingAudioId === msg._id ? (
                        <Pause className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-emerald-300 transition-all ${
                          playingAudioId === msg._id ? 'w-3/4 animate-pulse' : 'w-1/3'
                        }`}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[13.5px] sm:text-sm leading-snug whitespace-pre-wrap break-words pr-1">
                    {msg.content}
                  </p>
                )}

                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-white/65">
                  <span>{formatTime(msg.createdAt)}</span>
                  {isMe && (
                    String(msg._id).startsWith('tmp_') ? (
                      <Clock className="h-3 w-3 text-white/50" />
                    ) : msg.isRead ? (
                      <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" title="Seen" />
                    ) : (partnerStatus === 'online' || partnerStatus === 'typing') ? (
                      <CheckCheck className="h-3.5 w-3.5 text-zinc-400" title="Delivered" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-zinc-400" title="Sent" />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={listEndRef} />
      </div>

      {/* WhatsApp Pill Composer */}
      <form
        onSubmit={handleSendText}
        className="shrink-0 flex items-center gap-2 border-t border-white/5 bg-[#1F2C34] px-2.5 sm:px-6 py-2"
      >
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#2A3942] px-4 py-2 shadow-inner">
          {recording ? (
            <div className="flex flex-1 items-center gap-2 text-xs text-rose-300">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Recording {recordSeconds}s</span>
            </div>
          ) : (
            <input
              type="text"
              value={textInput}
              onChange={handleInputChange}
              placeholder="Message"
              className="w-full bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none"
            />
          )}
        </div>

        {textInput.trim().length > 0 ? (
          <button
            type="submit"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] hover:bg-[#06CF9C] text-[#0B141A] shadow-lg transition-colors"
            title="Send"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        ) : recording ? (
          <button
            type="button"
            onClick={stopVoiceRecord}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-colors"
            title="Stop & Send Voice"
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startVoiceRecord}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] hover:bg-[#06CF9C] text-[#0B141A] shadow-lg transition-colors"
            title="Voice Note"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
};

export default EphemeralChat;
