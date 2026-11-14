import React from 'react';
import { motion } from 'framer-motion';
import { RotateCw, Sparkles, Calendar, Layers } from 'lucide-react';
import { optimizeCloudinaryUrl } from '../../utils/apiClient';

export const PolaroidFallbackList = ({ stations = [], onSwitchTo3D }) => {
  const [flippedIds, setFlippedIds] = React.useState({});

  const toggleFlip = (id) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mx-auto h-[100dvh] max-w-3xl overflow-y-auto px-3 sm:px-4 pt-20 sm:pt-24 pb-28">
      <div className="mb-5 sm:mb-6 flex flex-wrap items-center justify-between gap-2 border border-[#333333] bg-surface p-3.5 sm:p-4 pr-24 sm:pr-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#00F0FF]">
            MEMORY DECK
          </span>
          <h2 className="font-serif text-xl sm:text-2xl italic text-primary">
            The 2-Year Express Milestones
          </h2>
        </div>
        {onSwitchTo3D && (
          <button
            type="button"
            onClick={onSwitchTo3D}
            className="flex items-center gap-1.5 border border-[#00F0FF] bg-[#00F0FF]/10 px-3 py-1.5 font-mono text-xs uppercase text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>3D JOURNEY VIEW</span>
          </button>
        )}
      </div>

      <div className="space-y-8">
        {stations.map((station, idx) => {
          const isFlipped = Boolean(flippedIds[station._id || idx]);
          const primaryAsset = station.assets?.[0];
          const tiltDeg = idx % 2 === 0 ? -1.5 : 1.5;

          return (
            <motion.div
              key={station._id || idx}
              initial={{ opacity: 0, y: 24, rotate: tiltDeg }}
              animate={{ opacity: 1, y: 0, rotate: tiltDeg }}
              whileHover={{ rotate: 0, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              onClick={() => toggleFlip(station._id || idx)}
              className="cursor-pointer border border-[#333333] bg-surface p-5 shadow-[0_0_20px_rgba(0,0,0,0.65)]"
            >
              <div className="mb-3 flex items-center justify-between font-mono text-xs uppercase text-secondary">
                <span className="text-[#00F0FF] font-bold">
                  STATION 0{station.trackOrder + 1} // {station.environmentTheme}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(station.milestoneDate).toLocaleDateString()}
                </span>
              </div>

              {!isFlipped ? (
                <div>
                  {primaryAsset?.url && (
                    <div className="relative h-64 w-full overflow-hidden border border-[#333333] bg-black">
                      <img
                        src={optimizeCloudinaryUrl(primaryAsset.url)}
                        alt={station.stationTitle}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-2xl italic text-primary">
                        {station.stationTitle}
                      </h3>
                      {primaryAsset?.caption && (
                        <p className="mt-1 font-mono text-xs text-secondary">
                          {primaryAsset.caption}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 border border-[#333333] px-2.5 py-1 font-mono text-[10px] uppercase text-[#00F0FF]">
                      <RotateCw className="h-3 w-3" /> FLIP NOTE
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col justify-between border border-[#00F0FF]/50 bg-background p-6">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FF003C]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>SECRET POLAROID REVERSE // {station.stationTitle}</span>
                  </div>
                  <p className="my-4 font-serif text-lg italic leading-relaxed text-primary">
                    &ldquo;{station.secretLetter || 'Forever etched on this stop of our journey.'}&rdquo;
                  </p>
                  <div className="flex justify-end font-mono text-[10px] uppercase text-[#00F0FF]">
                    [TAP TO FLIP BACK TO PHOTO]
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('[CHRONOS WEBGL SAFEGUARD] Falling back to 2D Polaroid Timeline:', error);
  }

  render() {
    if (this.state.hasError) {
      return <PolaroidFallbackList stations={this.props.stations} />;
    }
    return this.props.children;
  }
}

export default WebGLErrorBoundary;

