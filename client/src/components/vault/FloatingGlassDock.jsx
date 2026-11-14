import React from 'react';
import {
  TrainFront,
  MessageCircle,
  Clapperboard,
  Gamepad2,
  PhoneCall,
} from 'lucide-react';

const DOCK_ITEMS = [
  { id: 'train', label: 'Journey', icon: TrainFront },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'cinema', label: 'Watch', icon: Clapperboard },
  { id: 'call', label: 'Call', icon: PhoneCall },
  { id: 'arcade', label: 'Play', icon: Gamepad2 },
];

const FloatingGlassDock = ({ activeTab, onChangeTab, callActive = false, unreadChatCount = 0 }) => {
  return (
    <nav className="fixed bottom-[max(env(safe-area-inset-bottom,0px),8px)] left-1/2 -translate-x-1/2 z-40 max-w-[98vw] select-none pointer-events-auto">
      <div className="flex items-center gap-0.5 sm:gap-1.5 rounded-full border border-white/15 bg-black/85 px-1.5 sm:px-2 py-1 sm:py-1.5 backdrop-blur-xl shadow-2xl">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const showLiveDot = item.id === 'call' && callActive;
          const showChatBadge = item.id === 'chat' && unreadChatCount > 0 && !isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`relative flex items-center gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium transition-all active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-[#FF7B54] to-[#E11D48] text-white shadow-lg shadow-rose-900/40'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={`${isActive ? 'inline' : 'hidden sm:inline'} whitespace-nowrap`}>
                {item.label}
              </span>
              {showLiveDot && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {showChatBadge && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-600 px-1 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default FloatingGlassDock;
