import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gamepad2,
  Trophy,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Bot,
  Users,
  Send,
} from 'lucide-react';
import { normalizeCanvasCoords, clamp } from '../../utils/coordinateMath';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { arcadeSfx, setArcadeMuted } from './arcadeAudio';
import {
  spawnSparks,
  stepAndDrawHockey,
  stepAndDrawSubmarine,
  stepAndDrawSumo,
} from './arcadeGames';
import ConnectFourGame from './ConnectFourGame';
import MemoryMatchGame from './MemoryMatchGame';
import ReflexDuelGame from './ReflexDuelGame';

const GAMES = [
  {
    id: 'air-hockey',
    title: 'NEON AIR HOCKEY',
    subtitle: 'First to 7 • Spin Strikes',
    tag: 'ACTION',
    kind: 'canvas',
  },
  {
    id: 'connect-four',
    title: 'NEON CONNECT 4',
    subtitle: 'Drop Discs • 4-in-a-Row',
    tag: 'STRATEGY',
    kind: 'board',
  },
  {
    id: 'memory-match',
    title: 'MEMORY FLIP',
    subtitle: '8 Neon Pairs • Brain Duel',
    tag: 'PUZZLE',
    kind: 'board',
  },
  {
    id: 'neon-reflex',
    title: 'NEON REFLEX',
    subtitle: 'Quick-Draw • ms Speed',
    tag: 'SPEED',
    kind: 'board',
  },
  {
    id: 'sumo-bumper',
    title: 'SUMO RING',
    subtitle: 'Shrinking Arena • Dash',
    tag: 'BRAWL',
    kind: 'canvas',
  },
  {
    id: 'sync-or-swim',
    title: 'SYNC OR SWIM',
    subtitle: 'Trench Dive • Co-Op',
    tag: 'ARCADE',
    kind: 'canvas',
  },
];

const CANVAS_GAME_IDS = new Set(['air-hockey', 'sync-or-swim', 'sumo-bumper']);

const createInitialState = (bestSwimScore = 0) => ({
  phase: 'playing', // 'ready' | 'playing' | 'round_over' | 'game_over'
  winnerText: '',
  myNx: 0.5,
  myNy: 0.82,
  prevMyNx: 0.5,
  prevMyNy: 0.82,
  myVx: 0,
  myVy: 0,
  partnerNx: 0.5,
  partnerNy: 0.18,
  partnerTargetNx: 0.5,
  partnerTargetNy: 0.18,
  partnerVx: 0,
  partnerVy: 0,
  puckX: 0.5,
  puckY: 0.5,
  puckVx: (Math.random() > 0.5 ? 1 : -1) * 0.34,
  puckVy: (Math.random() > 0.5 ? 1 : -1) * 0.42,
  puckTrail: [],
  goalPauseTimer: 0,
  scoreHer: 0,
  scoreHim: 0,
  flappyY: 0.48,
  flappyVy: 0,
  bubbleCooldown: 0,
  pipes: [
    { x: 0.85, gapY: 0.46, scored: false, hasPearl: true, pearlCollected: false },
    { x: 1.48, gapY: 0.58, scored: false, hasPearl: true, pearlCollected: false },
  ],
  gatesCleared: 0,
  bestSwimScore,
  sumoMyX: 0.5,
  sumoMyY: 0.68,
  sumoMyVx: 0,
  sumoMyVy: 0,
  sumoPartnerX: 0.5,
  sumoPartnerY: 0.32,
  sumoPartnerVx: 0,
  sumoPartnerVy: 0,
  sumoRingShrink: 0,
  sumoDashCooldown: 0,
  particles: [],
  shake: 0,
  lastEmitMs: 0,
});

const ArcadeRoom = () => {
  const { role } = useAuth();
  const {
    socket,
    connected,
    peerCount,
    pendingDuoLaunch,
    sendArcadeInvite,
    clearPendingDuoLaunch,
  } = useSocket();

  const [selectedGameId, setSelectedGameId] = useState('air-hockey');
  const [playMode, setPlayMode] = useState('ai'); // 'ai' | 'duo'
  const [muted, setMuted] = useState(false);
  const [bestSwim, setBestSwim] = useState(0);
  const [overlay, setOverlay] = useState(null);
  const [boardResetNonce, setBoardResetNonce] = useState(0);
  const [inviteStatus, setInviteStatus] = useState('');

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasSizeRef = useRef({ width: 360, height: 480 });
  const scoreHudRef = useRef(null);
  const gameStateRef = useRef(createInitialState(0));

  const partnerLabel = role === 'PARTNER_HER' ? 'HIM' : 'HER';
  const activeGame = GAMES.find((g) => g.id === selectedGameId) || GAMES[0];
  const isCanvasGame = CANVAS_GAME_IDS.has(selectedGameId);

  const setHudText = useCallback((text) => {
    if (scoreHudRef.current) {
      scoreHudRef.current.textContent = text;
    }
  }, []);

  const startRoundOrReset = useCallback(
    (gameId, keepSumoScores = false) => {
      const prev = gameStateRef.current;
      const next = createInitialState(Math.max(prev.bestSwimScore, bestSwim));

      if (gameId === 'sync-or-swim') {
        next.phase = 'ready';
      } else if (gameId === 'sumo-bumper') {
        next.phase = 'playing';
        next.myNy = 0.68;
        if (keepSumoScores) {
          next.scoreHer = prev.scoreHer;
          next.scoreHim = prev.scoreHim;
        }
      }

      gameStateRef.current = next;
      if (gameId === 'sync-or-swim') {
        setOverlay({
          phase: 'ready',
          winnerText: 'TAP TO DIVE',
          score: playMode === 'duo' ? 'CO-OP WITH PARTNER' : 'SOLO TRENCH RUN',
        });
      } else {
        setOverlay(null);
      }
      setBoardResetNonce((n) => n + 1);
    },
    [bestSwim, playMode]
  );

  // Auto-join when an in-app Duo invite is accepted by either partner
  useEffect(() => {
    if (!pendingDuoLaunch?.gameId) return;
    const validGame = GAMES.some((g) => g.id === pendingDuoLaunch.gameId)
      ? pendingDuoLaunch.gameId
      : 'air-hockey';
    setPlayMode('duo');
    setSelectedGameId(validGame);
    startRoundOrReset(validGame, false);
    setInviteStatus(`DUO READY WITH ${partnerLabel}`);
    clearPendingDuoLaunch();
  }, [pendingDuoLaunch, partnerLabel, startRoundOrReset, clearPendingDuoLaunch]);

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      setArcadeMuted(next);
      return next;
    });
  };

  const handleSendInvite = () => {
    setPlayMode('duo');
    setInviteStatus('SENDING...');
    sendArcadeInvite(activeGame.id, activeGame.title, (res) => {
      if (!res?.success) {
        setInviteStatus('OFFLINE — CHECK CONNECTION');
      } else if (res.partnerOnline) {
        setInviteStatus(`INVITED ${partnerLabel}!`);
      } else {
        setInviteStatus(`INVITE SENT TO ${partnerLabel}`);
      }
      setTimeout(() => setInviteStatus(''), 3500);
    });
  };

  // High-DPR responsive Canvas Sizing via ResizeObserver
  useEffect(() => {
    if (!isCanvasGame) return undefined;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(240, Math.floor(rect.width));
      const cssH = Math.max(240, Math.floor(rect.height));

      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvasSizeRef.current = { width: cssW, height: cssH };

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isCanvasGame, selectedGameId]);

  // Receive 30Hz partner telemetry & Sync-or-Swim co-op tap boosts
  useEffect(() => {
    if (!socket || playMode !== 'duo') return undefined;
    const handleGameUpdate = (payload) => {
      if (payload.gameId && payload.gameId !== selectedGameId) return;
      const st = gameStateRef.current;
      st.partnerTargetNx = 1 - clamp(Number(payload.x || 0.5), 0.06, 0.94);
      st.partnerTargetNy = 1 - clamp(Number(payload.y || 0.8), 0.06, 0.94);

      if (payload.boostTap && selectedGameId === 'sync-or-swim') {
        if (st.phase === 'ready') {
          st.phase = 'playing';
          setOverlay(null);
        }
        if (st.phase === 'playing') {
          st.flappyVy = -0.58;
          arcadeSfx.boost();
          spawnSparks(st.particles, 0.25, st.flappyY, '#FF003C', 6, 0.28);
        }
      }

      if (payload.authoritative && role === 'PARTNER_HER') {
        if (typeof payload.puckX === 'number') {
          st.puckX = st.puckX + (1 - payload.puckX - st.puckX) * 0.5;
          st.puckY = st.puckY + (1 - payload.puckY - st.puckY) * 0.5;
        }
        if (typeof payload.scoreHer === 'number') {
          st.scoreHer = payload.scoreHer;
          st.scoreHim = payload.scoreHim;
        }
      }
    };

    socket.on('game:update', handleGameUpdate);
    return () => {
      socket.off('game:update', handleGameUpdate);
    };
  }, [socket, role, selectedGameId, playMode]);

  const handlePhaseChange = useCallback((phase, meta) => {
    if (typeof meta?.numericScore === 'number') {
      setBestSwim((prevBest) => {
        const nextBest = Math.max(prevBest, meta.numericScore);
        gameStateRef.current.bestSwimScore = nextBest;
        return nextBest;
      });
    }
    setOverlay({ phase, winnerText: meta.winnerText, score: meta.score });
  }, []);

  // Frame-rate independent animation loop for Canvas games
  useEffect(() => {
    if (!isCanvasGame) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let animId = null;
    let lastTime = performance.now();
    const useAiOpponent = playMode === 'ai' || peerCount < 2;

    const frame = (timestamp) => {
      const dt = clamp((timestamp - lastTime) / 1000, 0.001, 0.05);
      lastTime = timestamp;

      const { width: W, height: H } = canvasSizeRef.current;
      const st = gameStateRef.current;

      ctx.save();
      if (st.shake > 0.001) {
        const mag = st.shake * Math.min(W, H);
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        st.shake *= Math.pow(0.84, dt * 60);
      }

      ctx.fillStyle = '#070709';
      ctx.fillRect(-20, -20, W + 40, H + 40);

      let hudLine = '';
      if (selectedGameId === 'air-hockey') {
        hudLine = stepAndDrawHockey({
          ctx,
          st,
          W,
          H,
          dt,
          timestamp,
          isSolo: useAiOpponent,
          onPhaseChange: handlePhaseChange,
        });
      } else if (selectedGameId === 'sync-or-swim') {
        hudLine = stepAndDrawSubmarine({
          ctx,
          st,
          W,
          H,
          dt,
          timestamp,
          onPhaseChange: handlePhaseChange,
        });
      } else {
        hudLine = stepAndDrawSumo({
          ctx,
          st,
          W,
          H,
          dt,
          timestamp,
          isSolo: useAiOpponent,
          onPhaseChange: handlePhaseChange,
        });
      }

      ctx.restore();

      if (scoreHudRef.current && hudLine) {
        scoreHudRef.current.textContent = hudLine;
      }

      if (playMode === 'duo' && socket && timestamp - st.lastEmitMs >= 33) {
        st.lastEmitMs = timestamp;
        socket.emit('game:update', {
          gameId: selectedGameId,
          x: selectedGameId === 'sumo-bumper' ? st.sumoMyX : st.myNx,
          y: selectedGameId === 'sumo-bumper' ? st.sumoMyY : st.myNy,
          authoritative: role === 'PARTNER_HIM',
          puckX: st.puckX,
          puckY: st.puckY,
          scoreHer: st.scoreHer,
          scoreHim: st.scoreHim,
        });
      }

      animId = window.requestAnimationFrame(frame);
    };

    animId = window.requestAnimationFrame(frame);
    return () => {
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, [isCanvasGame, selectedGameId, socket, peerCount, playMode, role, handlePhaseChange]);

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const { nx, ny } = normalizeCanvasCoords(clientX, clientY, rect);

    gameStateRef.current.myNx = clamp(nx, 0.08, 0.92);
    gameStateRef.current.myNy =
      selectedGameId === 'air-hockey' ? clamp(ny, 0.54, 0.93) : clamp(ny, 0.08, 0.92);
  };

  const triggerSubBoost = useCallback(() => {
    const st = gameStateRef.current;
    if (st.phase === 'ready') {
      st.phase = 'playing';
      setOverlay(null);
    } else if (st.phase === 'game_over') {
      startRoundOrReset('sync-or-swim');
      gameStateRef.current.phase = 'playing';
      gameStateRef.current.flappyVy = -0.58;
      setOverlay(null);
      arcadeSfx.boost();
      return;
    }

    if (st.phase === 'playing') {
      st.flappyVy = -0.58;
      arcadeSfx.boost();
      spawnSparks(st.particles, 0.25, st.flappyY, '#00F0FF', 5, 0.25);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
      if (playMode === 'duo' && socket) {
        socket.emit('game:update', {
          gameId: 'sync-or-swim',
          boostTap: true,
        });
      }
    }
  }, [playMode, socket, startRoundOrReset]);

  const triggerSumoDash = useCallback(() => {
    const st = gameStateRef.current;
    if (st.phase !== 'playing' || st.sumoDashCooldown > 0) return;

    const dx = st.myNx - st.sumoMyX;
    const dy = st.myNy - st.sumoMyY;
    const mag = Math.hypot(dx, dy);
    const dirX = mag > 0.01 ? dx / mag : st.sumoPartnerX - st.sumoMyX;
    const dirY = mag > 0.01 ? dy / mag : st.sumoPartnerY - st.sumoMyY;
    const dMag = Math.max(0.001, Math.hypot(dirX, dirY));

    st.sumoMyVx += (dirX / dMag) * 1.35;
    st.sumoMyVy += (dirY / dMag) * 1.35;
    st.sumoDashCooldown = 1.1;
    arcadeSfx.dash();
    spawnSparks(st.particles, st.sumoMyX, st.sumoMyY, '#FACC15', 8, 0.4);
  }, []);

  const handleCanvasDown = (e) => {
    handlePointerMove(e);
    if (selectedGameId === 'sync-or-swim') {
      triggerSubBoost();
    } else if (selectedGameId === 'sumo-bumper') {
      if (gameStateRef.current.phase === 'round_over') {
        startRoundOrReset('sumo-bumper', true);
      } else {
        triggerSumoDash();
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space') {
        if (selectedGameId === 'sync-or-swim') {
          e.preventDefault();
          triggerSubBoost();
        } else if (selectedGameId === 'sumo-bumper') {
          e.preventDefault();
          triggerSumoDash();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedGameId, triggerSubBoost, triggerSumoDash]);

  return (
    <div className="relative h-full w-full max-w-2xl mx-auto overflow-hidden flex flex-col justify-between px-2 sm:px-3 vault-header-clearance vault-dock-clearance select-none touch-none">
      <div className="space-y-1 shrink-0">
        {/* Top Control Strip: Compact Title + AI/DUO + Invite/Audio/Reset */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00F0FF]">
            <Gamepad2 className="h-4 w-4 shrink-0" />
            <span className="hidden xs:inline">Arcade</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* VS AI vs DUO Toggle */}
            <div className="inline-flex rounded-full border border-white/15 bg-black/60 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setPlayMode('ai');
                  startRoundOrReset(selectedGameId, false);
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors ${
                  playMode === 'ai'
                    ? 'bg-[#00F0FF] text-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Bot className="h-3 w-3" />
                <span>AI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayMode('duo');
                  startRoundOrReset(selectedGameId, false);
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors ${
                  playMode === 'duo'
                    ? 'bg-[#FF003C] text-white'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Users className="h-3 w-3" />
                <span>Duo</span>
              </button>
            </div>

            {playMode === 'duo' && (
              <button
                type="button"
                onClick={handleSendInvite}
                disabled={!connected}
                className="inline-flex items-center gap-1 rounded-full bg-[#FF003C] hover:bg-[#ff2659] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
                title={`Invite ${partnerLabel}`}
              >
                <Send className="h-3 w-3" />
                <span className="hidden sm:inline">Invite</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-zinc-300 hover:border-[#00F0FF]"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-[#FF003C]" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-[#00F0FF]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => startRoundOrReset(selectedGameId, false)}
              aria-label="Reset game"
              className="flex h-7 w-7 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-full border border-white/15 bg-black/60 text-[10px] font-semibold text-zinc-200 hover:border-[#00F0FF]"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Sleek Single-Row 6-Game Pill Strip */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {GAMES.map((g) => {
            const active = selectedGameId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setSelectedGameId(g.id);
                  startRoundOrReset(g.id, false);
                }}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                  active
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-white shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                    : 'border-white/10 bg-zinc-900/80 text-zinc-400 hover:text-white'
                }`}
              >
                {g.title.replace('NEON ', '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Live Score HUD */}
      <div className="my-1 shrink-0 flex items-center justify-between gap-2 rounded-full border border-white/10 bg-zinc-950/90 px-3 py-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-[#00F0FF] font-semibold truncate">
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          <span ref={scoreHudRef}>YOU: 0 // AI: 0</span>
        </span>
        <span className="text-[10px] font-medium text-zinc-400 shrink-0">
          {inviteStatus
            ? inviteStatus
            : playMode === 'duo'
              ? peerCount >= 2
                ? 'Duo Live'
                : 'Waiting...'
              : 'Solo AI'}
        </span>
      </div>

      {/* Active Game Arena */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#070709] p-1 sm:p-2">
        {isCanvasGame ? (
          <div ref={containerRef} className="relative h-full w-full max-w-[440px]">
            <canvas
              ref={canvasRef}
              onPointerDown={handleCanvasDown}
              onPointerMove={handlePointerMove}
              onTouchMove={handlePointerMove}
              className="block h-full w-full touch-none cursor-crosshair"
            />

            {overlay && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 p-4 text-center backdrop-blur-[2px]">
                <h3 className="font-serif text-2xl sm:text-3xl italic text-white">
                  {overlay.winnerText}
                </h3>
                {overlay.score && (
                  <p className="mt-1 font-mono text-xs uppercase tracking-widest text-[#00F0FF]">
                    {overlay.score}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (overlay.phase === 'ready') {
                      triggerSubBoost();
                    } else if (overlay.phase === 'round_over') {
                      startRoundOrReset('sumo-bumper', true);
                    } else {
                      startRoundOrReset(selectedGameId, false);
                    }
                  }}
                  className="mt-4 inline-flex items-center gap-2 border border-[#00F0FF] bg-[#00F0FF] px-5 py-2.5 font-mono text-xs font-bold uppercase text-black shadow-[0_0_20px_rgba(0,240,255,0.45)] hover:bg-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>
                    {overlay.phase === 'ready'
                      ? 'TAP TO DIVE'
                      : overlay.phase === 'round_over'
                        ? 'NEXT ROUND'
                        : 'PLAY AGAIN'}
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : selectedGameId === 'connect-four' ? (
          <ConnectFourGame
            playMode={playMode}
            role={role}
            socket={socket}
            peerCount={peerCount}
            resetNonce={boardResetNonce}
            onHudUpdate={setHudText}
          />
        ) : selectedGameId === 'memory-match' ? (
          <MemoryMatchGame
            playMode={playMode}
            role={role}
            socket={socket}
            peerCount={peerCount}
            resetNonce={boardResetNonce}
            onHudUpdate={setHudText}
          />
        ) : (
          <ReflexDuelGame
            playMode={playMode}
            role={role}
            socket={socket}
            peerCount={peerCount}
            resetNonce={boardResetNonce}
            onHudUpdate={setHudText}
          />
        )}
      </div>
    </div>
  );
};

export default ArcadeRoom;
