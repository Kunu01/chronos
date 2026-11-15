import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCw,
  Volume2,
  VolumeX,
  Layers,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ChevronUp,
} from 'lucide-react';
import { apiRequest, optimizeCloudinaryUrl, unlockAudioContext } from '../../utils/apiClient';
import { clamp } from '../../utils/coordinateMath';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';
import WebGLErrorBoundary, { PolaroidFallbackList } from './WebGLErrorBoundary';
import TrainScene3D from './TrainScene3D';

const CAMERA_MODES = ['AUTO', 'FPP', 'TPP'];

const DEFAULT_STATIONS = [];

const ratioToTrackT = (ratio, count) => {
  if (count <= 1) return 0.2;
  return 0.06 + clamp(ratio, 0, 1) * 0.88;
};

const trackTToRatio = (t, count) => {
  if (count <= 1) return 0;
  return clamp((t - 0.06) / 0.88, 0, 1);
};

const TrainTimelineCanvas = ({
  themeMode = 'light',
  initialProgress = null,
  onProgressChange,
}) => {
  const { vaultToken } = useAuth();
  const { timelineVersion } = useSocket();
  const { theme } = useTheme();

  const [stations, setStations] = useState(DEFAULT_STATIONS);
  const [activeStationIdx, setActiveStationIdx] = useState(0);
  const [autopilot, setAutopilot] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selectedPolaroid, setSelectedPolaroid] = useState(null);
  const [polaroidFlipped, setPolaroidFlipped] = useState(false);
  const [fallback2DMode, setFallback2DMode] = useState(false);
  const [cameraMode, setCameraMode] = useState('AUTO');
  const [effectiveView, setEffectiveView] = useState('FPP');
  const [hasSwiped, setHasSwiped] = useState(false);

  const startT =
    typeof initialProgress === 'number' &&
    initialProgress >= 0.05 &&
    initialProgress <= 0.95
      ? initialProgress
      : 0.06;

  const progressBarRef = useRef(null);
  const targetProgressRef = useRef(startT);
  const currentProgressRef = useRef(startT);
  const cameraModeRef = useRef('AUTO');
  const autopilotRef = useRef(false);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastYRef = useRef(null);
  const lastReportedSavedTRef = useRef(startT);
  const synthOscRef = useRef(null);
  const proximityGainRef = useRef(null);

  cameraModeRef.current = cameraMode;
  autopilotRef.current = autopilot;

  useEffect(() => {
    let mounted = true;
    const loadTimeline = async () => {
      try {
        const data = await apiRequest('/memories', { token: vaultToken });
        if (mounted && Array.isArray(data)) {
          setStations(data);
        }
      } catch {
        if (mounted) setStations([]);
      }
    };
    loadTimeline();
    return () => {
      mounted = false;
    };
  }, [vaultToken, timelineVersion]);

  const updateProgressBarDom = useCallback(
    (t) => {
      const ratio = trackTToRatio(t, stations.length);
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
      }
      if (
        onProgressChange &&
        Math.abs(t - lastReportedSavedTRef.current) > 0.015
      ) {
        lastReportedSavedTRef.current = t;
        onProgressChange(t);
      }
    },
    [stations.length, onProgressChange]
  );

  // Sync initial progress indicator
  useEffect(() => {
    updateProgressBarDom(targetProgressRef.current);
  }, [stations.length, updateProgressBarDom]);

  // Direct Momentum + Soft Station Arrival Loop (No native scrollbar!)
  useEffect(() => {
    let rafId;
    let lastTime = performance.now();

    const step = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (autopilotRef.current) {
        let next = targetProgressRef.current + 0.038 * dt;
        if (next > 0.94) next = 0.06;
        targetProgressRef.current = next;
        updateProgressBarDom(next);
      } else if (!draggingRef.current) {
        // Coast momentum briefly after flick
        if (Math.abs(velocityRef.current) > 0.00008) {
          const next = clamp(
            targetProgressRef.current + velocityRef.current,
            0.05,
            0.95
          );
          targetProgressRef.current = next;
          velocityRef.current *= 0.88;
          updateProgressBarDom(next);
        } else if (stations.length > 1) {
          // Gentle arrival detent: ease smoothly onto the nearest station stop so train never stops mid-void
          const stepSpan = 0.88 / (stations.length - 1);
          const idxFloat = (targetProgressRef.current - 0.06) / stepSpan;
          const nearest = Math.round(clamp(idxFloat, 0, stations.length - 1));
          const stationT = 0.06 + nearest * stepSpan;
          if (Math.abs(targetProgressRef.current - stationT) < stepSpan * 0.24) {
            const pulled =
              targetProgressRef.current +
              (stationT - targetProgressRef.current) * Math.min(1, dt * 4.5);
            targetProgressRef.current = pulled;
            updateProgressBarDom(pulled);
          }
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [stations.length, updateProgressBarDom]);

  // Touch swipe handlers: SWIPE BOTTOM -> UP moves train FORWARD!
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    if (autopilotRef.current) setAutopilot(false);
    draggingRef.current = true;
    velocityRef.current = 0;
    lastYRef.current = e.touches[0].clientY;
    if (!hasSwiped) setHasSwiped(true);
  };

  const handleTouchMove = (e) => {
    if (!draggingRef.current || e.touches.length !== 1 || lastYRef.current === null) {
      return;
    }
    const currY = e.touches[0].clientY;
    // Swipe UP (currY < lastYRef) -> deltaY > 0 -> train moves FORWARD
    // Swipe DOWN (currY > lastYRef) -> deltaY < 0 -> train moves BACKWARD
    const deltaY = lastYRef.current - currY;
    lastYRef.current = currY;

    const scale = 0.00042;
    const stepDelta = clamp(deltaY * scale, -0.025, 0.025);
    const next = clamp(targetProgressRef.current + stepDelta, 0.05, 0.95);
    targetProgressRef.current = next;
    velocityRef.current = clamp(stepDelta * 0.55, -0.014, 0.014);
    updateProgressBarDom(next);
  };

  const handleTouchEnd = () => {
    draggingRef.current = false;
    lastYRef.current = null;
  };

  // Mouse wheel & trackpad gesture: scroll down = forward, scroll up = backward
  const handleWheel = (e) => {
    if (autopilotRef.current) setAutopilot(false);
    if (!hasSwiped) setHasSwiped(true);
    const stepDelta = clamp(e.deltaY * 0.00028, -0.025, 0.025);
    const next = clamp(targetProgressRef.current + stepDelta, 0.05, 0.95);
    targetProgressRef.current = next;
    velocityRef.current = clamp(stepDelta * 0.35, -0.012, 0.012);
    updateProgressBarDom(next);
  };

  const jumpToStation = useCallback(
    (idx) => {
      if (!stations.length) return;
      setAutopilot(false);
      velocityRef.current = 0;
      const clampedIdx = clamp(idx, 0, stations.length - 1);
      const ratio = stations.length <= 1 ? 0 : clampedIdx / (stations.length - 1);
      const t = ratioToTrackT(ratio, stations.length);
      setActiveStationIdx(clampedIdx);
      targetProgressRef.current = t;
      updateProgressBarDom(t);
    },
    [stations.length, updateProgressBarDom]
  );

  // Spatial audio
  const toggleCoupeRadio = () => {
    const ctx = unlockAudioContext();
    if (!ctx) return;

    if (audioEnabled) {
      if (synthOscRef.current) {
        try {
          synthOscRef.current.stop();
        } catch {
          // ignore
        }
        synthOscRef.current = null;
      }
      proximityGainRef.current = null;
      setAudioEnabled(false);
    } else {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(132 + activeStationIdx * 24, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        synthOscRef.current = osc;
        proximityGainRef.current = gain;
        setAudioEnabled(true);
      } catch {
        setAudioEnabled(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (synthOscRef.current) {
        try {
          synthOscRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const currentStation = stations[activeStationIdx] || null;

  if (fallback2DMode) {
    return (
      <PolaroidFallbackList
        stations={stations}
        onSwitchTo3D={() => setFallback2DMode(false)}
      />
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="relative h-[100dvh] w-full overflow-hidden touch-none select-none bg-[#05070B]"
    >
      <WebGLErrorBoundary stations={stations}>
        <Canvas
          shadows
          camera={{ position: [0, 2.2, 6], fov: 56, near: 0.1, far: 900 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.06,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              setFallback2DMode(true);
            });
          }}
        >
          <TrainScene3D
            stations={stations}
            targetProgressRef={targetProgressRef}
            currentProgressRef={currentProgressRef}
            cameraModeRef={cameraModeRef}
            onEffectiveModeChange={setEffectiveView}
            activeStationIdx={activeStationIdx}
            setActiveStationIdx={setActiveStationIdx}
            onOpenPolaroid={(st) => {
              setSelectedPolaroid(st);
              setPolaroidFlipped(false);
            }}
            amoledMode={theme === 'amoled' || themeMode === 'dark'}
            proximityGainRef={proximityGainRef}
          />
        </Canvas>
      </WebGLErrorBoundary>

      {/* Subtle Cinematic Edge Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 62%, rgba(8, 6, 12, 0.36) 100%)',
        }}
      />

      {/* Clean Visual-First HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between px-2.5 sm:px-5 vault-header-clearance vault-dock-clearance">
        {/* Top Controls: Camera View Switcher & Compact Station Badge */}
        <div className="flex items-center justify-between gap-1.5 w-full max-w-xl mx-auto">
          <div className="pointer-events-auto inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-white/15 bg-black/70 p-0.5 sm:p-1 backdrop-blur-xl shadow-lg">
            {CAMERA_MODES.map((mode) => {
              const active = cameraMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCameraMode(mode)}
                  className={`rounded-full px-2 sm:px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95 ${
                    active
                      ? 'bg-gradient-to-r from-[#FF7B54] to-[#E11D48] text-white'
                      : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {mode === 'AUTO' ? `Auto · ${effectiveView}` : mode}
                </button>
              );
            })}
          </div>

          {currentStation && (
            <motion.button
              key={currentStation._id || activeStationIdx}
              type="button"
              onClick={() => {
                setSelectedPolaroid(currentStation);
                setPolaroidFlipped(false);
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 sm:px-3 py-1.5 backdrop-blur-xl shadow-lg hover:border-rose-400/50 transition-colors active:scale-95"
            >
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                {activeStationIdx + 1}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-white max-w-[100px] xs:max-w-[140px] sm:max-w-[180px] truncate">
                {currentStation.stationTitle}
              </span>
              <ImageIcon className="h-3 w-3 text-rose-300 shrink-0" />
            </motion.button>
          )}
        </div>

        {/* Empty state or Gentle One-time Swipe Up Cue */}
        {stations.length === 0 ? (
          <div className="mx-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-medium text-amber-300 backdrop-blur-xl shadow-lg">
            <span>✨ Timeline Clean · Awaiting your first milestone from Admin Studio</span>
          </div>
        ) : !hasSwiped ? (
          <div className="mx-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3.5 py-1.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md animate-bounce shadow-lg">
            <ChevronUp className="h-3.5 w-3.5 text-rose-400" />
            <span>Swipe up to ride</span>
          </div>
        ) : null}

        {/* Compact Bottom Control Strip - Pulled down closely above navigation dock */}
        <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-black/80 px-3 py-1.5 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => jumpToStation(activeStationIdx - 1)}
                disabled={stations.length === 0 || activeStationIdx <= 0}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
                aria-label="Previous stop"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setAutopilot((a) => !a)}
                disabled={stations.length === 0}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  autopilot
                    ? 'bg-gradient-to-r from-[#FF7B54] to-[#E11D48] text-white'
                    : 'bg-white/10 text-zinc-200 hover:bg-white/15'
                }`}
              >
                {autopilot ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{autopilot ? 'Pause' : 'Cruise'}</span>
              </button>

              <button
                type="button"
                onClick={() => jumpToStation(activeStationIdx + 1)}
                disabled={stations.length === 0 || activeStationIdx >= stations.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
                aria-label="Next stop"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCoupeRadio}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  audioEnabled
                    ? 'bg-rose-500/25 text-rose-300'
                    : 'bg-white/10 text-zinc-400'
                }`}
                title="Ambient Audio"
              >
                {audioEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFallback2DMode(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-300 hover:text-white"
                title="2D Deck"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Slim Progress Track + Station Dots */}
          <div className="space-y-1.5">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/15">
              <div
                ref={progressBarRef}
                className="h-full rounded-full bg-gradient-to-r from-[#FF7B54] to-[#E11D48] transition-[width] duration-75"
                style={{ width: '0%' }}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar">
              {stations.map((st, idx) => (
                <button
                  key={st._id || idx}
                  type="button"
                  onClick={() => jumpToStation(idx)}
                  aria-label={st.stationTitle || `Stop ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === activeStationIdx
                      ? 'w-5 bg-rose-400'
                      : 'w-2 bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Polaroid Flip Modal */}
      <AnimatePresence>
        {selectedPolaroid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPolaroid(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, rotate: -2 }}
              animate={{
                scale: 1,
                rotate: polaroidFlipped ? 0 : 1.5,
                rotateY: polaroidFlipped ? 180 : 0,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={(e) => {
                e.stopPropagation();
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  navigator.vibrate(35);
                }
                setPolaroidFlipped((f) => !f);
              }}
              className="w-full max-w-md cursor-pointer rounded-2xl border border-white/20 bg-zinc-950 p-4 shadow-2xl"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {!polaroidFlipped ? (
                <div>
                  {selectedPolaroid.assets?.[0]?.url && (
                    <div className="h-64 sm:h-72 w-full overflow-hidden rounded-xl bg-black">
                      <img
                        src={optimizeCloudinaryUrl(selectedPolaroid.assets[0].url)}
                        alt={selectedPolaroid.stationTitle}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white truncate">
                        {selectedPolaroid.stationTitle}
                      </h2>
                      {selectedPolaroid.assets?.[0]?.caption && (
                        <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">
                          {selectedPolaroid.assets[0].caption}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-rose-300">
                      <RotateCw className="h-3 w-3" />
                      <span>Flip</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{ transform: 'rotateY(180deg)' }}
                  className="flex min-h-[290px] flex-col justify-between rounded-xl border border-white/10 bg-zinc-900 p-5"
                >
                  <h3 className="text-lg font-semibold text-white">
                    {selectedPolaroid.stationTitle}
                  </h3>
                  <p className="my-5 font-serif text-base italic leading-relaxed text-zinc-200">
                    &ldquo;
                    {selectedPolaroid.secretLetter ||
                      'Every kilometer between us only made this stop brighter.'}
                    &rdquo;
                  </p>
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-zinc-400">
                    <span>Tap card to flip</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPolaroid(null);
                      }}
                      className="text-rose-400 hover:underline font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrainTimelineCanvas;
