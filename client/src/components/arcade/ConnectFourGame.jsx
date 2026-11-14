import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import { arcadeSfx } from './arcadeAudio';

const ROWS = 6;
const COLS = 7;

const createEmptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const findDropRow = (board, col) => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
};

const checkWinner = (board) => {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of dirs) {
        const line = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) {
            break;
          }
          line.push([nr, nc]);
        }
        if (line.length === 4) {
          return { winner: player, line };
        }
      }
    }
  }
  const full = board[0].every((cell) => cell !== 0);
  if (full) return { winner: 'draw', line: [] };
  return null;
};

const chooseAiColumn = (board) => {
  const validCols = [];
  for (let c = 0; c < COLS; c++) {
    if (findDropRow(board, c) !== -1) validCols.push(c);
  }
  if (!validCols.length) return -1;

  // 1. Take immediate winning move for AI (2)
  for (const c of validCols) {
    const r = findDropRow(board, c);
    const copy = board.map((row) => [...row]);
    copy[r][c] = 2;
    if (checkWinner(copy)?.winner === 2) return c;
  }

  // 2. Block immediate winning move for Player (1)
  for (const c of validCols) {
    const r = findDropRow(board, c);
    const copy = board.map((row) => [...row]);
    copy[r][c] = 1;
    if (checkWinner(copy)?.winner === 1) return c;
  }

  // 3. Filter out moves that directly hand Player a win above them
  const safeCols = validCols.filter((c) => {
    const r = findDropRow(board, c);
    if (r === 0) return true;
    const copy = board.map((row) => [...row]);
    copy[r][c] = 2;
    copy[r - 1][c] = 1;
    return checkWinner(copy)?.winner !== 1;
  });

  const pool = safeCols.length ? safeCols : validCols;
  const centerOrder = [3, 2, 4, 1, 5, 0, 6];
  let bestScore = -Infinity;
  let bestCol = pool[0];

  for (const c of pool) {
    const r = findDropRow(board, c);
    let score = (4 - Math.abs(3 - c)) * 3 + Math.random() * 1.6;
    if (centerOrder.indexOf(c) <= 2) score += 1.5;
    // Bonus for orthogonal/diagonal friendly neighbors
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ]) {
      const nr1 = r + dr;
      const nc1 = c + dc;
      const nr2 = r - dr;
      const nc2 = c - dc;
      if (nr1 >= 0 && nr1 < ROWS && nc1 >= 0 && nc1 < COLS && board[nr1][nc1] === 2) score += 2;
      if (nr2 >= 0 && nr2 < ROWS && nc2 >= 0 && nc2 < COLS && board[nr2][nc2] === 2) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
  }
  return bestCol;
};

const ConnectFourGame = ({ playMode, role, socket, peerCount, resetNonce, onHudUpdate }) => {
  const isDuo = playMode === 'duo';
  const myNum = isDuo ? (role === 'PARTNER_HER' ? 1 : 2) : 1;
  const partnerNum = myNum === 1 ? 2 : 1;
  const partnerLabel = role === 'PARTNER_HER' ? 'HIM' : 'HER';

  const [board, setBoard] = useState(createEmptyBoard);
  const [starterNum, setStarterNum] = useState(1);
  const [turnNum, setTurnNum] = useState(1);
  const [result, setResult] = useState(null); // { winner, line }
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [lastDrop, setLastDrop] = useState(null);
  const aiTimerRef = useRef(null);
  const boardRef = useRef(board);
  boardRef.current = board;

  const resetBoard = useCallback((nextStarter = 1, resetScoresToo = false) => {
    clearTimeout(aiTimerRef.current);
    const empty = createEmptyBoard();
    boardRef.current = empty;
    setBoard(empty);
    setTurnNum(nextStarter);
    setStarterNum(nextStarter);
    setResult(null);
    setLastDrop(null);
    if (resetScoresToo) {
      setScores({ p1: 0, p2: 0 });
    }
  }, []);

  useEffect(() => {
    resetBoard(1, true);
  }, [playMode, resetNonce, resetBoard]);

  useEffect(() => {
    const p1Label = isDuo ? (myNum === 1 ? 'YOU' : partnerLabel) : 'YOU';
    const p2Label = isDuo ? (myNum === 2 ? 'YOU' : partnerLabel) : 'AI';
    onHudUpdate?.(`${p1Label}: ${scores.p1}  //  ${p2Label}: ${scores.p2}`);
  }, [scores, isDuo, myNum, partnerLabel, onHudUpdate]);

  const applyDrop = useCallback((col, playerNum) => {
    const prev = boardRef.current;
    const row = findDropRow(prev, col);
    if (row === -1) return;

    const next = prev.map((r) => [...r]);
    next[row][col] = playerNum;
    boardRef.current = next;
    setBoard(next);
    setLastDrop(`${row}-${col}`);

    const check = checkWinner(next);
    if (check) {
      setResult(check);
      if (check.winner === 1) {
        setScores((s) => ({ ...s, p1: s.p1 + 1 }));
        arcadeSfx.win();
      } else if (check.winner === 2) {
        setScores((s) => ({ ...s, p2: s.p2 + 1 }));
        arcadeSfx.goal();
      } else {
        arcadeSfx.wall();
      }
    } else {
      setTurnNum(playerNum === 1 ? 2 : 1);
      arcadeSfx.hit();
    }
  }, []);

  // AI turn trigger
  useEffect(() => {
    if (isDuo || result || turnNum !== 2) return undefined;
    aiTimerRef.current = setTimeout(() => {
      const col = chooseAiColumn(board);
      if (col !== -1) applyDrop(col, 2);
    }, 380);
    return () => clearTimeout(aiTimerRef.current);
  }, [isDuo, result, turnNum, board, applyDrop]);

  // Listen to Partner Duo moves
  useEffect(() => {
    if (!socket || !isDuo) return undefined;
    const onEvent = (payload) => {
      if (payload?.gameId !== 'connect-four') return;
      if (payload.type === 'drop' && typeof payload.col === 'number') {
        applyDrop(payload.col, partnerNum);
      } else if (payload.type === 'reset') {
        resetBoard(payload.nextStarter === 2 ? 2 : 1, false);
      }
    };
    socket.on('arcade:event', onEvent);
    return () => socket.off('arcade:event', onEvent);
  }, [socket, isDuo, partnerNum, applyDrop, resetBoard]);

  const handleColumnTap = (col) => {
    if (result) return;
    if (turnNum !== myNum) return;
    if (findDropRow(board, col) === -1) return;

    applyDrop(col, myNum);
    if (isDuo && socket) {
      socket.emit('arcade:event', { gameId: 'connect-four', type: 'drop', col });
    }
  };

  const handlePlayAgain = () => {
    const nextStarter = starterNum === 1 ? 2 : 1;
    resetBoard(nextStarter, false);
    if (isDuo && socket) {
      socket.emit('arcade:event', { gameId: 'connect-four', type: 'reset', nextStarter });
    }
  };

  const isWinCell = (r, c) =>
    result?.line?.some(([wr, wc]) => wr === r && wc === c);

  const turnStatus = result
    ? result.winner === 'draw'
      ? 'DRAW MATCH'
      : result.winner === myNum
        ? 'YOU CONNECT 4!'
        : isDuo
          ? `${partnerLabel} CONNECTS 4!`
          : 'AI CONNECTS 4!'
    : turnNum === myNum
      ? 'YOUR TURN — TAP ANY COLUMN'
      : isDuo
        ? peerCount < 2
          ? `WAITING FOR ${partnerLabel} TO JOIN DUO...`
          : `${partnerLabel} IS THINKING...`
        : 'AI THINKING...';

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-1 sm:p-3 select-none overflow-hidden">
      <div className="mb-1.5 sm:mb-2.5 flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-wider">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            turnNum === 1 ? 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]' : 'bg-[#FF003C] shadow-[0_0_8px_#FF003C]'
          }`}
        />
        <span className="text-neutral-200">{turnStatus}</span>
      </div>

      {/* 7x6 Neon Board - Scaled to mobile viewports */}
      <div className="w-full max-w-[min(290px,82vw)] border-2 border-[#333333] bg-[#0b0e16] p-1.5 sm:p-2 shadow-[0_0_24px_rgba(0,0,0,0.85)]">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {board.map((rowArr, rIdx) =>
            rowArr.map((cell, cIdx) => {
              const highlight = isWinCell(rIdx, cIdx);
              const fresh = lastDrop === `${rIdx}-${cIdx}`;
              return (
                <button
                  key={`${rIdx}-${cIdx}`}
                  type="button"
                  onClick={() => handleColumnTap(cIdx)}
                  disabled={Boolean(result) || turnNum !== myNum || findDropRow(board, cIdx) === -1}
                  aria-label={`Column ${cIdx + 1}`}
                  className="aspect-square w-full rounded-full border border-[#242836] bg-[#05060a] p-0.5 flex items-center justify-center transition-colors hover:border-[#00F0FF]/50 disabled:cursor-default"
                >
                  {cell !== 0 && (
                    <motion.div
                      initial={fresh ? { y: -140, scale: 0.9 } : false}
                      animate={{ y: 0, scale: highlight ? [1, 1.12, 1] : 1 }}
                      transition={
                        highlight
                          ? { repeat: Infinity, duration: 0.9 }
                          : { type: 'spring', stiffness: 420, damping: 24 }
                      }
                      className={`h-full w-full rounded-full ${
                        cell === 1
                          ? 'bg-[#00F0FF] shadow-[0_0_12px_#00F0FF]'
                          : 'bg-[#FF003C] shadow-[0_0_12px_#FF003C]'
                      } ${highlight ? 'ring-2 ring-white' : ''}`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {result && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlayAgain}
            className="inline-flex items-center gap-2 border border-[#00F0FF] bg-[#00F0FF] px-4 py-2 font-mono text-xs font-bold uppercase text-black shadow-[0_0_16px_rgba(0,240,255,0.4)] hover:bg-white"
          >
            <Play className="h-3.5 w-3.5" />
            <span>NEXT ROUND</span>
          </button>
          {result.winner === myNum && (
            <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400">
              <Sparkles className="h-3.5 w-3.5" /> +1 WIN
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectFourGame;
