import React, { useState } from 'react';
import {
  HeartPulse,
  Sun,
  Moon,
  LogOut,
  Shield,
  ShieldOff,
  Check,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';

const DynamicIsland = ({ partnerRole = 'HER', onTriggerPanic }) => {
  const { minimizeShield, toggleMinimizeShield } = useAuth();
  const { partnerStatus, triggerThinkingOfYou } = useSocket();
  const { theme, cycleVaultTheme } = useTheme();
  const [pulseFeedback, setPulseFeedback] = useState(false);

  const isOnline = partnerStatus === 'online' || partnerStatus === 'typing';

  const handleSendPulse = () => {
    setPulseFeedback(true);
    triggerThinkingOfYou();
    setTimeout(() => setPulseFeedback(false), 1200);
  };

  return (
    <div className="fixed top-[max(env(safe-area-inset-top,0px),8px)] left-1/2 -translate-x-1/2 z-40 w-[96vw] max-w-xl px-1 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-between gap-1.5 sm:gap-2 rounded-full border border-white/15 bg-black/80 px-2.5 sm:px-3.5 py-1.5 backdrop-blur-xl shadow-2xl">
        {/* Status Pill */}
        <div className="flex items-center gap-1.5 pl-1 shrink-0">
          <span
            className={`h-2 w-2 rounded-full ${
              isOnline
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-zinc-500'
            }`}
          />
          <span className="text-[11px] font-medium tracking-wide text-zinc-100">
            {partnerRole === 'HER' ? 'Her' : 'Him'}
          </span>
        </div>

        {/* Action Pills (Icon-first, low-text) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={toggleMinimizeShield}
            title={
              minimizeShield === 'auto'
                ? 'App switch auto-hides to CraveBook (tap for Hold mode)'
                : 'Stay unlocked while switching apps (tap for Auto-hide)'
            }
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all ${
              minimizeShield === 'auto'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                : 'bg-white/10 text-zinc-200 hover:bg-white/15'
            }`}
          >
            {minimizeShield === 'auto' ? (
              <Shield className="h-3 w-3" />
            ) : (
              <ShieldOff className="h-3 w-3 opacity-80" />
            )}
            <span className="hidden xs:inline">
              {minimizeShield === 'auto' ? 'Auto' : 'Hold'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleSendPulse}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              pulseFeedback
                ? 'bg-rose-500 text-white'
                : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
            }`}
            title="Send pulse"
          >
            {pulseFeedback ? (
              <Check className="h-3 w-3" />
            ) : (
              <HeartPulse className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">Pulse</span>
          </button>

          <button
            type="button"
            onClick={cycleVaultTheme}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors"
            title={theme === 'amoled' ? 'Dark theme' : 'AMOLED black'}
          >
            {theme === 'amoled' ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onTriggerPanic}
            className="inline-flex items-center gap-1 rounded-full bg-red-600/90 hover:bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
            title="Switch to CraveBook (keeps Resume Savepoint)"
          >
            <LogOut className="h-3 w-3" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicIsland;
