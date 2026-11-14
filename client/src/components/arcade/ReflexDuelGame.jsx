import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Play, AlertTriangle } from 'lucide-react';
import { arcadeSfx } from './arcadeAudio';

const TARGET_ROUNDS = 3;

const ReflexDuelGame = ({ playMode, role, socket, peerCount, resetNonce, onHudUpdate }) => {
  const isDuo = playMode === 'duo';
  const partnerLabel = role === 'PARTNER_HER' ? 'HIM' : 'HER';

  const [phase, setPhase] = useState('idle'); // 'idle' | 'armed' | 'go' | 'waiting_partner' | 'round_result' | 'match_over'
  const [roundNum, setRoundNum] = useState(1);
  const [scores, setScores] = useState({ me: 0, opp: 0 });
  const [myTime, setMyTime] = useState(null);
  const [oppTime, setOppTime] = useState(null);
  const [bannerText, setBannerText] = useState('TAP TO START ROUND 1');
  const [subText, setSubText] = useState('First to win 3 quick-draw rounds takes the crown.');

  const armTimerRef = useRef(null);
  const aiTimerRef = useRef(null);
  const goAtRef = useRef(0);
  const myRoundDataRef = useRef(null);
  const oppRoundDataRef = useRef(null);
  const roundNumRef = useRef(1);
  const scoresRef = useRef({ me: 0, opp: 0 });

  roundNumRef.current = roundNum;
  scoresRef.current = scores;

  const clearTimers = useCallback(() => {
    clearTimeout(armTimerRef.current);
    clearTimeout(aiTimerRef.current);
  }, []);

  const resetMatch = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setRoundNum(1);
    setScores({ me: 0, opp: 0 });
    setMyTime(null);
    setOppTime(null);
    myRoundDataRef.current = null;
    oppRoundDataRef.current = null;
    setBannerText('TAP TO START ROUND 1');
    setSubText(
      isDuo
        ? `Duo Reflex vs ${partnerLabel} • Fastest reaction wins!`
        : 'Wait for the cyan flash, then tap fast!'
    );
  }, [clearTimers, isDuo, partnerLabel]);

  useEffect(() => {
    resetMatch();
    return clearTimers;
  }, [playMode, resetNonce, resetMatch, clearTimers]);

  useEffect(() => {
    const oppName = isDuo ? partnerLabel : 'AI';
    onHudUpdate?.(`YOU: ${scores.me}  //  ${oppName}: ${scores.opp}  •  FIRST TO ${TARGET_ROUNDS}`);
  }, [scores, isDuo, partnerLabel, onHudUpdate]);

  const finishRound = useCallback(
    (mine, theirs) => {
      clearTimers();
      let meWon = false;
      let label = '';

      if (mine.falseStart && theirs.falseStart) {
        label = 'DOUBLE FALSE START!';
      } else if (mine.falseStart) {
        label = isDuo ? `FALSE START! POINT ${partnerLabel}` : 'FALSE START! POINT AI';
      } else if (theirs.falseStart) {
        meWon = true;
        label = isDuo ? `${partnerLabel} FALSE STARTED! +1 YOU` : 'OPPONENT FALSE START! +1 YOU';
      } else if (mine.timeMs <= theirs.timeMs) {
        meWon = true;
        label = `YOU WERE FASTER! (${mine.timeMs} ms)`;
      } else {
        label = `${isDuo ? partnerLabel : 'AI'} WAS FASTER (${theirs.timeMs} ms)`;
      }

      const nextScores = {
        me: scoresRef.current.me + (meWon ? 1 : 0),
        opp: scoresRef.current.opp + (!meWon && !(mine.falseStart && theirs.falseStart) ? 1 : 0),
      };
      setScores(nextScores);
      setMyTime(mine.falseStart ? 'EARLY' : `${mine.timeMs} ms`);
      setOppTime(theirs.falseStart ? 'EARLY' : `${theirs.timeMs} ms`);

      if (meWon) arcadeSfx.goal();
      else arcadeSfx.crash();

      if (nextScores.me >= TARGET_ROUNDS || nextScores.opp >= TARGET_ROUNDS) {
        arcadeSfx.win();
        setPhase('match_over');
        setBannerText(nextScores.me >= TARGET_ROUNDS ? 'LIGHTNING WINNER!' : `${isDuo ? partnerLabel : 'AI'} WINS MATCH`);
        setSubText(label);
      } else {
        setPhase('round_result');
        setBannerText(label);
        setSubText('Tap for Next Round');
      }
    },
    [clearTimers, isDuo, partnerLabel]
  );

  const armRound = useCallback(
    (nextRoundNum, delayMs, broadcast = false) => {
      clearTimers();
      myRoundDataRef.current = null;
      oppRoundDataRef.current = null;
      setRoundNum(nextRoundNum);
      setMyTime(null);
      setOppTime(null);
      setPhase('armed');
      setBannerText(`ROUND ${nextRoundNum} — HOLD STEADY...`);
      setSubText('Do not tap until the screen flashes CYAN!');

      if (broadcast && isDuo && socket) {
        socket.emit('arcade:event', {
          gameId: 'neon-reflex',
          type: 'arm',
          roundNum: nextRoundNum,
          delayMs,
        });
      }

      armTimerRef.current = setTimeout(() => {
        goAtRef.current = performance.now();
        setPhase('go');
        setBannerText('FLASH! TAP NOW!');
        setSubText('GO GO GO!');
        arcadeSfx.cue();

        if (!isDuo) {
          const aiReaction = Math.round(230 + Math.random() * 145);
          aiTimerRef.current = setTimeout(() => {
            if (!myRoundDataRef.current) {
              oppRoundDataRef.current = { timeMs: aiReaction, falseStart: false };
              setOppTime(`${aiReaction} ms`);
            }
          }, aiReaction);
        }
      }, delayMs);
    },
    [clearTimers, isDuo, socket]
  );

  // Listen to partner events in Duo mode
  useEffect(() => {
    if (!socket || !isDuo) return undefined;
    const onEvent = (payload) => {
      if (payload?.gameId !== 'neon-reflex') return;
      if (payload.type === 'arm') {
        armRound(Number(payload.roundNum || 1), Number(payload.delayMs || 2000), false);
      } else if (payload.type === 'tap' && Number(payload.roundNum) === roundNumRef.current) {
        const oppResult = {
          timeMs: Number(payload.timeMs || 999),
          falseStart: Boolean(payload.falseStart),
        };
        oppRoundDataRef.current = oppResult;
        setOppTime(oppResult.falseStart ? 'EARLY' : `${oppResult.timeMs} ms`);

        if (oppResult.falseStart && !myRoundDataRef.current) {
          finishRound({ timeMs: 0, falseStart: false }, oppResult);
        } else if (myRoundDataRef.current) {
          finishRound(myRoundDataRef.current, oppResult);
        }
      } else if (payload.type === 'reset') {
        resetMatch();
      }
    };
    socket.on('arcade:event', onEvent);
    return () => socket.off('arcade:event', onEvent);
  }, [socket, isDuo, armRound, finishRound, resetMatch]);

  const handleTap = useCallback(() => {
    if (phase === 'idle') {
      const delay = Math.round(1400 + Math.random() * 2200);
      armRound(1, delay, true);
      return;
    }

    if (phase === 'round_result') {
      const delay = Math.round(1400 + Math.random() * 2200);
      armRound(roundNum + 1, delay, true);
      return;
    }

    if (phase === 'match_over') {
      resetMatch();
      if (isDuo && socket) {
        socket.emit('arcade:event', { gameId: 'neon-reflex', type: 'reset' });
      }
      return;
    }

    if (phase === 'armed') {
      const myRes = { timeMs: 0, falseStart: true };
      myRoundDataRef.current = myRes;
      if (isDuo && socket) {
        socket.emit('arcade:event', {
          gameId: 'neon-reflex',
          type: 'tap',
          roundNum,
          timeMs: 0,
          falseStart: true,
        });
      }
      finishRound(myRes, oppRoundDataRef.current || { timeMs: 300, falseStart: false });
      return;
    }

    if (phase === 'go') {
      const reaction = Math.max(45, Math.round(performance.now() - goAtRef.current));
      const myRes = { timeMs: reaction, falseStart: false };
      myRoundDataRef.current = myRes;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }

      if (!isDuo) {
        const oppRes = oppRoundDataRef.current || {
          timeMs: Math.round(235 + Math.random() * 145),
          falseStart: false,
        };
        finishRound(myRes, oppRes);
      } else {
        if (socket) {
          socket.emit('arcade:event', {
            gameId: 'neon-reflex',
            type: 'tap',
            roundNum,
            timeMs: reaction,
            falseStart: false,
          });
        }
        if (oppRoundDataRef.current) {
          finishRound(myRes, oppRoundDataRef.current);
        } else {
          setMyTime(`${reaction} ms`);
          setPhase('waiting_partner');
          setBannerText(`YOU: ${reaction} MS`);
          setSubText(
            peerCount < 2
              ? `Tap Next if ${partnerLabel} is not in Duo.`
              : `Waiting for ${partnerLabel}'s draw...`
          );
        }
      }
    }
  }, [phase, roundNum, isDuo, socket, peerCount, partnerLabel, armRound, finishRound, resetMatch]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  const zoneBg =
    phase === 'go'
      ? 'border-[#00F0FF] bg-[#00F0FF]/25 shadow-[0_0_50px_rgba(0,240,255,0.45)]'
      : phase === 'armed'
        ? 'border-[#FF003C]/80 bg-[#1c0a12]'
        : 'border-[#333333] bg-[#0b0d14]';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-2 sm:p-3 select-none overflow-hidden">
      <button
        type="button"
        onPointerDown={handleTap}
        className={`flex h-full max-h-[min(260px,42vh)] w-full max-w-[min(300px,82vw)] flex-col items-center justify-center border-2 p-4 sm:p-5 text-center transition-colors ${zoneBg}`}
      >
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-current text-[#00F0FF]">
          {phase === 'armed' ? (
            <AlertTriangle className="h-7 w-7 animate-pulse text-[#FF003C]" />
          ) : phase === 'match_over' || phase === 'idle' ? (
            <Play className="h-7 w-7 text-[#00F0FF]" />
          ) : (
            <Zap className="h-7 w-7 text-[#00F0FF]" />
          )}
        </div>

        <h3 className="font-mono text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
          {bannerText}
        </h3>
        <p className="mt-1.5 font-mono text-xs text-neutral-300">{subText}</p>

        {(myTime || oppTime) && (
          <div className="mt-5 grid w-full max-w-[260px] grid-cols-2 gap-2 border-t border-[#333333] pt-3 font-mono text-xs">
            <div>
              <div className="text-[10px] text-neutral-400">YOU</div>
              <div className="font-bold text-[#00F0FF]">{myTime || '...'}</div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-400">{isDuo ? partnerLabel : 'AI'}</div>
              <div className="font-bold text-[#FF003C]">{oppTime || '...'}</div>
            </div>
          </div>
        )}
      </button>

      {phase === 'waiting_partner' && (
        <button
          type="button"
          onClick={() => armRound(roundNum + 1, 1800, true)}
          className="mt-3 border border-[#333333] bg-[#1E1E1E] px-3 py-1.5 font-mono text-[10px] uppercase text-neutral-300 hover:border-[#00F0FF]"
        >
          FORCE NEXT ROUND
        </button>
      )}
    </div>
  );
};

export default ReflexDuelGame;

