import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Flame,
  Zap,
  Moon,
  Star,
  Crown,
  Music,
  Compass,
  Play,
  HelpCircle,
} from 'lucide-react';
import { arcadeSfx } from './arcadeAudio';

const SYMBOLS = [
  { id: 'heart', Icon: Heart, color: '#FF003C' },
  { id: 'zap', Icon: Zap, color: '#00F0FF' },
  { id: 'crown', Icon: Crown, color: '#FACC15' },
  { id: 'flame', Icon: Flame, color: '#FB923C' },
  { id: 'moon', Icon: Moon, color: '#A855F7' },
  { id: 'star', Icon: Star, color: '#38BDF8' },
  { id: 'music', Icon: Music, color: '#34D399' },
  { id: 'compass', Icon: Compass, color: '#F472B6' },
];

const createShuffledOrder = () => {
  const arr = [...SYMBOLS.map((s) => s.id), ...SYMBOLS.map((s) => s.id)];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const MemoryMatchGame = ({ playMode, role, socket, peerCount, resetNonce, onHudUpdate }) => {
  const isDuo = playMode === 'duo';
  const myNum = isDuo ? (role === 'PARTNER_HER' ? 1 : 2) : 1;
  const partnerLabel = role === 'PARTNER_HER' ? 'HIM' : 'HER';

  const [deck, setDeck] = useState(() => createShuffledOrder());
  const [matched, setMatched] = useState([]); // pairIds already solved
  const [flipped, setFlipped] = useState([]); // active 0..2 indices
  const [turnNum, setTurnNum] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [busy, setBusy] = useState(false);

  const aiMemoryRef = useRef(new Map()); // index -> pairId
  const timersRef = useRef([]);
  const deckRef = useRef(deck);
  const flippedRef = useRef(flipped);
  const matchedRef = useRef(matched);
  deckRef.current = deck;
  flippedRef.current = flipped;
  matchedRef.current = matched;

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const startFreshDeck = useCallback(
    (customOrder = null, broadcast = false) => {
      clearAllTimers();
      const nextDeck = customOrder || createShuffledOrder();
      deckRef.current = nextDeck;
      flippedRef.current = [];
      matchedRef.current = [];
      setDeck(nextDeck);
      setMatched([]);
      setFlipped([]);
      setTurnNum(1);
      setScores({ p1: 0, p2: 0 });
      setBusy(false);
      aiMemoryRef.current.clear();

      if (broadcast && isDuo && socket) {
        socket.emit('arcade:event', { gameId: 'memory-match', type: 'deck_sync', deck: nextDeck });
      }
    },
    [clearAllTimers, isDuo, socket]
  );

  useEffect(() => {
    const order = createShuffledOrder();
    startFreshDeck(order, isDuo && role === 'PARTNER_HER');
    return clearAllTimers;
  }, [playMode, resetNonce, role, isDuo, startFreshDeck, clearAllTimers]);

  useEffect(() => {
    const p1Label = isDuo ? (myNum === 1 ? 'YOU' : partnerLabel) : 'YOU';
    const p2Label = isDuo ? (myNum === 2 ? 'YOU' : partnerLabel) : 'AI';
    onHudUpdate?.(`${p1Label}: ${scores.p1}  //  ${p2Label}: ${scores.p2}  •  8 PAIRS`);
  }, [scores, isDuo, myNum, partnerLabel, onHudUpdate]);

  const totalFound = matched.length;
  const gameDone = totalFound === SYMBOLS.length;

  const flipCardAt = useCallback(
    (index, actorNum) => {
      const currentDeck = deckRef.current;
      const prevFlipped = flippedRef.current;
      const prevMatched = matchedRef.current;
      if (prevFlipped.includes(index) || prevFlipped.length >= 2) return;
      const pairId = currentDeck[index];
      if (!pairId || prevMatched.includes(pairId)) return;

      aiMemoryRef.current.set(index, pairId);
      arcadeSfx.flip();
      const nextFlipped = [...prevFlipped, index];
      flippedRef.current = nextFlipped;
      setFlipped(nextFlipped);

      if (nextFlipped.length === 2) {
        setBusy(true);
        const [i1, i2] = nextFlipped;
        const isMatch = currentDeck[i1] === currentDeck[i2];

        schedule(() => {
          if (isMatch) {
            if (!matchedRef.current.includes(currentDeck[i1])) {
              const updated = [...matchedRef.current, currentDeck[i1]];
              matchedRef.current = updated;
              setMatched(updated);
              if (updated.length === SYMBOLS.length) {
                arcadeSfx.win();
              } else {
                arcadeSfx.pearl();
              }
            }
            setScores((s) =>
              actorNum === 1 ? { ...s, p1: s.p1 + 1 } : { ...s, p2: s.p2 + 1 }
            );
            flippedRef.current = [];
            setFlipped([]);
            setBusy(false);
          } else {
            flippedRef.current = [];
            setFlipped([]);
            setTurnNum(actorNum === 1 ? 2 : 1);
            setBusy(false);
          }
        }, isMatch ? 420 : 760);
      }
    },
    [schedule]
  );

  // Listen to partner flips & deck sync in Duo
  useEffect(() => {
    if (!socket || !isDuo) return undefined;
    const onEvent = (payload) => {
      if (payload?.gameId !== 'memory-match') return;
      if (payload.type === 'deck_sync' && Array.isArray(payload.deck) && payload.deck.length === 16) {
        startFreshDeck(payload.deck, false);
      } else if (payload.type === 'flip' && typeof payload.index === 'number') {
        const partnerActor = payload.fromRole === 'PARTNER_HER' ? 1 : 2;
        flipCardAt(payload.index, partnerActor);
      }
    };
    socket.on('arcade:event', onEvent);
    return () => socket.off('arcade:event', onEvent);
  }, [socket, isDuo, flipCardAt, startFreshDeck]);

  // Smart AI turn with remembered pair detection
  useEffect(() => {
    if (isDuo || gameDone || turnNum !== 2 || busy || flipped.length > 0) return undefined;

    const availableIndices = deck
      .map((id, idx) => ({ id, idx }))
      .filter((item) => !matched.includes(item.id))
      .map((item) => item.idx);
    if (availableIndices.length < 2) return undefined;

    // Look for a known pair in AI memory
    let pick1 = null;
    let pick2 = null;
    const byPair = new Map();
    for (const idx of availableIndices) {
      const remembered = aiMemoryRef.current.get(idx);
      if (remembered) {
        if (byPair.has(remembered)) {
          pick1 = byPair.get(remembered);
          pick2 = idx;
          break;
        }
        byPair.set(remembered, idx);
      }
    }

    if (pick1 === null) {
      const unknown = availableIndices.filter((idx) => !aiMemoryRef.current.has(idx));
      const pool1 = unknown.length ? unknown : availableIndices;
      pick1 = pool1[Math.floor(Math.random() * pool1.length)];

      // Check if pick1 matches a remembered card elsewhere
      const revealedId = deck[pick1];
      const knownMatch = availableIndices.find(
        (idx) => idx !== pick1 && aiMemoryRef.current.get(idx) === revealedId
      );
      if (knownMatch !== undefined && Math.random() < 0.85) {
        pick2 = knownMatch;
      } else {
        const rest = availableIndices.filter((idx) => idx !== pick1);
        pick2 = rest[Math.floor(Math.random() * rest.length)];
      }
    }

    schedule(() => {
      flipCardAt(pick1, 2);
      schedule(() => {
        flipCardAt(pick2, 2);
      }, 460);
    }, 520);

    return clearAllTimers;
  }, [isDuo, gameDone, turnNum, busy, flipped.length, deck, matched, flipCardAt, schedule, clearAllTimers]);

  const handleCardTap = (idx) => {
    if (gameDone || busy || turnNum !== myNum) return;
    if (flipped.includes(idx) || matched.includes(deck[idx])) return;

    flipCardAt(idx, myNum);
    if (isDuo && socket) {
      socket.emit('arcade:event', { gameId: 'memory-match', type: 'flip', index: idx });
    }
  };

  const statusText = gameDone
    ? scores.p1 === scores.p2
      ? 'PERFECT TIE!'
      : (myNum === 1 ? scores.p1 > scores.p2 : scores.p2 > scores.p1)
        ? 'YOU WON MEMORY DUEL!'
        : isDuo
          ? `${partnerLabel} WINS!`
          : 'AI WINS THIS ROUND!'
    : turnNum === myNum
      ? 'YOUR TURN — FLIP 2 CARDS'
      : isDuo
        ? peerCount < 2
          ? `WAITING FOR ${partnerLabel} IN DUO...`
          : `${partnerLabel}'S TURN...`
        : 'AI SEARCHING PAIRS...';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-1.5 sm:p-3 select-none overflow-hidden">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            turnNum === 1 ? 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]' : 'bg-[#FF003C] shadow-[0_0_8px_#FF003C]'
          }`}
        />
        <span className="text-neutral-200">{statusText}</span>
      </div>

      <div className="grid w-full max-w-[min(280px,80vw)] grid-cols-4 gap-1.5 sm:gap-2">
        {deck.map((pairId, idx) => {
          const isMatched = matched.includes(pairId);
          const isOpen = isMatched || flipped.includes(idx);
          const sym = SYMBOLS.find((s) => s.id === pairId) || SYMBOLS[0];
          const IconComp = sym.Icon;

          return (
            <motion.button
              key={`${idx}-${pairId}`}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleCardTap(idx)}
              disabled={isOpen || busy || turnNum !== myNum}
              className={`aspect-square w-full border-2 flex items-center justify-center transition-all ${
                isMatched
                  ? 'border-emerald-400/70 bg-[#101c1a]'
                  : isOpen
                    ? 'border-[#00F0FF] bg-[#141a24] shadow-[0_0_14px_rgba(0,240,255,0.28)]'
                    : 'border-[#333333] bg-[#12131a] hover:border-[#00F0FF]/50'
              }`}
            >
              {isOpen ? (
                <IconComp
                  className="h-6 w-6 sm:h-7 sm:w-7"
                  style={{ color: sym.color, filter: `drop-shadow(0 0 6px ${sym.color})` }}
                />
              ) : (
                <HelpCircle className="h-5 w-5 text-neutral-600" />
              )}
            </motion.button>
          );
        })}
      </div>

      {gameDone && (
        <button
          type="button"
          onClick={() => startFreshDeck(null, true)}
          className="mt-3.5 inline-flex items-center gap-2 border border-[#00F0FF] bg-[#00F0FF] px-4 py-2 font-mono text-xs font-bold uppercase text-black shadow-[0_0_16px_rgba(0,240,255,0.4)] hover:bg-white"
        >
          <Play className="h-3.5 w-3.5" />
          <span>PLAY AGAIN</span>
        </button>
      )}
    </div>
  );
};

export default MemoryMatchGame;
