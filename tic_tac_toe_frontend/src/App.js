import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import drawSfx from './assets/draw.mp3';
// Lazy-loadable SFX imports (webpack will bundle, but we keep small size and reuse)
/**
 * clickSfx: short tap for valid human moves
 * winSfx: pleasant chime for wins (not draws)
 * Note: assets are small; we will preload Audio instances on first user interaction.
 */
import clickSfx from './assets/click.mp3';
import winSfx from './assets/win.mp3';
// Lightweight confetti utility (tree-shaken, no extra config for CRA)
import confetti from 'canvas-confetti';

/**
 * Compute the winner of a tic-tac-toe board.
 * Returns an object:
 * - { winner: 'X'|'O', line: [a,b,c] } when there is a winner
 * - { winner: 'Draw', line: null } when all filled without a winner
 * - { winner: null, line: null } when game is in progress
 *
 * This allows the UI to highlight the exact winning line.
 */
function evaluateBoardDetailed(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] };
    }
  }
  if (squares.every(Boolean)) return { winner: 'Draw', line: null };
  return { winner: null, line: null };
}

/**
 * Backward-compatible simple evaluation for AI helpers and quick checks.
 * Returns:
 * - 'X' or 'O' if there is a winner
 * - 'Draw' if all cells are filled and no winner
 * - null if the game is still in progress
 */
function evaluateBoard(squares) {
  const res = evaluateBoardDetailed(squares);
  return res.winner;
}

/**
 * AI helpers
 */
function getAvailableMoves(sq) {
  const m = [];
  for (let i = 0; i < 9; i++) if (!sq[i]) m.push(i);
  return m;
}

function randomMove(sq) {
  const moves = getAvailableMoves(sq);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function canWinNextMove(sq, player) {
  const moves = getAvailableMoves(sq);
  for (const i of moves) {
    const copy = sq.slice();
    copy[i] = player;
    if (evaluateBoard(copy) === player) return i;
  }
  return null;
}

function pickCorner(sq) {
  const corners = [0, 2, 6, 8].filter((i) => !sq[i]);
  if (corners.length === 0) return null;
  return corners[Math.floor(Math.random() * corners.length)];
}

// Minimax for 3x3 tic-tac-toe, AI is 'O', human is 'X'
function minimax(sq, isMaximizing) {
  const result = evaluateBoard(sq);
  if (result === 'O') return { score: 1 };
  if (result === 'X') return { score: -1 };
  if (result === 'Draw') return { score: 0 };

  if (isMaximizing) {
    let best = { score: -Infinity, move: null };
    for (const i of getAvailableMoves(sq)) {
      const copy = sq.slice();
      copy[i] = 'O';
      const res = minimax(copy, false);
      if (res.score > best.score) best = { score: res.score, move: i };
    }
    return best;
  } else {
    let best = { score: Infinity, move: null };
    for (const i of getAvailableMoves(sq)) {
      const copy = sq.slice();
      copy[i] = 'X';
      const res = minimax(copy, true);
      if (res.score < best.score) best = { score: res.score, move: i };
    }
    return best;
  }
}

function getAiMove(sq, difficulty) {
  // Easy: random
  if (difficulty === 'easy') {
    return randomMove(sq);
  }
  // Medium: win -> block -> center -> corner -> random
  if (difficulty === 'medium') {
    const win = canWinNextMove(sq, 'O');
    if (win !== null) return win;
    const block = canWinNextMove(sq, 'X');
    if (block !== null) return block;
    if (!sq[4]) return 4;
    const corner = pickCorner(sq);
    if (corner !== null) return corner;
    return randomMove(sq);
  }
  // Hard: minimax optimal
  const { move } = minimax(sq, true);
  return move ?? randomMove(sq);
}

/**
 * A note on audio/autoplay:
 * We create the Audio element lazily and "unlock" it on first user interaction
 * (click/keydown) so that browsers allow playback. We also guard to play the
 * draw sound only once per game by tracking last outcome.
 */
// PUBLIC_INTERFACE
export default function App() {
  /** The 9 board cells; values are 'X', 'O', or null */
  const [squares, setSquares] = useState(Array(9).fill(null));
  /** True if it's X's turn, false for O's turn */
  const [xIsNext, setXIsNext] = useState(true);

  // Mode and difficulty
  const [mode, setMode] = useState('2p'); // '2p' | 'ai'
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [pendingAi, setPendingAi] = useState(false);

  // Sound state
  const [soundOn, setSoundOn] = useState(() => {
    try {
      const v = localStorage.getItem('ttt-sound');
      if (v === 'on') return true;
      if (v === 'off') return false;
    } catch {}
    return true;
  });

  // One audio element per SFX to allow overlapping in rare cases and keep code simple.
  const drawAudioRef = useRef(null);
  const clickAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const audioReadyRef = useRef(false);

  const lastOutcomeRef = useRef(null);

  // THEME state: initialize from localStorage or system preference
  const getInitialTheme = () => {
    const saved = (() => {
      try {
        return localStorage.getItem('ttt-theme');
      } catch {
        return null;
      }
    })();
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  };
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme to document element and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ttt-theme', theme);
    } catch {
      // ignore persistence errors
    }
  }, [theme]);

  // Determine game status with winning line info
  const evaluation = useMemo(() => evaluateBoardDetailed(squares), [squares]);
  const outcome = evaluation.winner;
  const winningLine = evaluation.line; // null for draw or in-progress
  const gameOver = outcome === 'X' || outcome === 'O' || outcome === 'Draw';

  const currentPlayer = xIsNext ? 'X' : 'O';
  const statusText = useMemo(() => {
    if (outcome === 'X') return 'X wins!';
    if (outcome === 'O') return 'O wins!';
    if (outcome === 'Draw') return "It's a draw.";
    return `Turn: ${currentPlayer}`;
  }, [outcome, currentPlayer]);

  // Scoreboard state with persistence
  const readScores = () => {
    try {
      const raw = localStorage.getItem('ttt-scores');
      if (!raw) return { x: 0, o: 0, draws: 0 };
      const parsed = JSON.parse(raw);
      const x = Number.isFinite(parsed?.x) ? parsed.x : 0;
      const o = Number.isFinite(parsed?.o) ? parsed.o : 0;
      const d = Number.isFinite(parsed?.draws) ? parsed.draws : 0;
      return { x, o, draws: d };
    } catch {
      return { x: 0, o: 0, draws: 0 };
    }
  };
  const [scores, setScores] = useState(readScores);

  // Persist scores when changed
  useEffect(() => {
    try {
      localStorage.setItem('ttt-scores', JSON.stringify(scores));
    } catch {
      // ignore
    }
  }, [scores]);

  // Increment appropriate score when a game ends
  const prevOutcomeRef = useRef(null);
  useEffect(() => {
    if (!gameOver) return;
    if (prevOutcomeRef.current === outcome) return;
    prevOutcomeRef.current = outcome;
    if (outcome === 'X') {
      setScores((s) => ({ ...s, x: s.x + 1 }));
    } else if (outcome === 'O') {
      setScores((s) => ({ ...s, o: s.o + 1 }));
    } else if (outcome === 'Draw') {
      setScores((s) => ({ ...s, draws: s.draws + 1 }));
    }
  }, [gameOver, outcome]);

  // PUBLIC_INTERFACE
  function resetScores() {
    /** Reset only the persistent scoreboard without altering current board state */
    setScores({ x: 0, o: 0, draws: 0 });
    try {
      localStorage.setItem('ttt-scores', JSON.stringify({ x: 0, o: 0, draws: 0 }));
    } catch {
      // ignore
    }
  }

  // Prepare audio lazily on first user gesture
  useEffect(() => {
    const unlock = () => {
      // Create and preload audio elements if not present
      if (!drawAudioRef.current) {
        drawAudioRef.current = new Audio(drawSfx);
        drawAudioRef.current.preload = 'auto';
      }
      if (!clickAudioRef.current) {
        clickAudioRef.current = new Audio(clickSfx);
        clickAudioRef.current.preload = 'auto';
      }
      if (!winAudioRef.current) {
        winAudioRef.current = new Audio(winSfx);
        winAudioRef.current.preload = 'auto';
      }

      // Attempt a silent play to satisfy autoplay policies; then pause and reset.
      const audios = [drawAudioRef.current, clickAudioRef.current, winAudioRef.current];

      // Chain play attempts; any resolution marks ready. Use volume 0 to avoid audible blip.
      const tryPrime = (audio) =>
        new Promise((resolve) => {
          try {
            audio.volume = 0;
            const p = audio.play();
            if (p && typeof p.then === 'function') {
              p
                .then(() => {
                  audio.pause();
                  audio.currentTime = 0;
                  audio.volume = 1;
                  resolve();
                })
                .catch(() => {
                  audio.pause();
                  audio.currentTime = 0;
                  audio.volume = 1;
                  resolve();
                });
            } else {
              audio.pause();
              audio.currentTime = 0;
              audio.volume = 1;
              resolve();
            }
          } catch {
            try {
              audio.pause();
              audio.currentTime = 0;
              audio.volume = 1;
            } catch {}
            resolve();
          }
        });

      Promise.all(audios.map(tryPrime)).finally(() => {
        audioReadyRef.current = true;
      });

      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Play draw sound exactly once when transitioning into draw state
  useEffect(() => {
    if (outcome === 'Draw' && lastOutcomeRef.current !== 'Draw') {
      lastOutcomeRef.current = 'Draw';
      if (soundOn) {
        const a = drawAudioRef.current || new Audio(drawSfx);
        drawAudioRef.current = a;
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    } else if (outcome !== 'Draw') {
      lastOutcomeRef.current = outcome;
    }
  }, [outcome, soundOn]);

  // Play win sound once when transitioning to a winner (X or O) and trigger confetti
  const confettiLaunchedRef = useRef(false);

  useEffect(() => {
    // Only act on actual wins
    const isWin = outcome === 'X' || outcome === 'O';
    if (isWin && lastOutcomeRef.current !== outcome) {
      lastOutcomeRef.current = outcome;

      // Audio (win chime)
      if (soundOn) {
        const a = winAudioRef.current || new Audio(winSfx);
        winAudioRef.current = a;
        try { a.currentTime = 0; } catch {}
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }

      // Confetti (trigger once per win)
      // Respect theme by using accent colors that look good on both themes.
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const colors = isDark
        ? ['#60a5fa', '#22d3ee', '#ffffff']   // light/dark friendly
        : ['#f59e0b', '#fbbf24', '#06b6d4'];

      // Initialize on first user interaction already set up for audio; confetti doesn't need unlock,
      // but we still keep the firing minimal and one-shot.
      if (!confettiLaunchedRef.current) {
        confettiLaunchedRef.current = true;

        // A small burst and a follow-up to feel celebratory without being heavy.
        const defaults = { spread: 70, ticks: 120, gravity: 0.9, scalar: 0.9, colors };
        confetti({ ...defaults, particleCount: 60, origin: { y: 0.3 } });
        setTimeout(() => confetti({ ...defaults, particleCount: 80, origin: { y: 0.2 } }), 120);
      }
    } else if (!isWin) {
      // Clear flag when leaving win state (e.g., on restart/new round), so next win can fire again.
      confettiLaunchedRef.current = false;
    }
  }, [outcome, soundOn]);

  // Trigger AI move after human 'X' moves in Vs AI mode, if game not over
  useEffect(() => {
    if (mode !== 'ai') {
      setPendingAi(false);
      return;
    }
    if (gameOver) {
      setPendingAi(false);
      return;
    }
    // AI plays as 'O' when it's O's turn
    if (!xIsNext) {
      // Guard UI (disable human input) by marking pending
      setPendingAi(true);
      // small delay for UX; also allows animation frame to settle
      const t = setTimeout(() => {
        setPendingAi(false);
        setSquares((prev) => {
          // Double-check not ended and still O's turn for consistency
          if (evaluateBoard(prev)) return prev;
          const move = getAiMove(prev, difficulty);
          if (move === null || prev[move]) return prev;
          const next = prev.slice();
          next[move] = 'O';
          return next;
        });
        setXIsNext(true); // After AI (O), next is X
      }, 250);
      return () => clearTimeout(t);
    }
  }, [mode, xIsNext, squares, difficulty, gameOver]);

  // PUBLIC_INTERFACE
  function handleSquareClick(index) {
    /** Handle a move: ignore if filled or game over or AI turn */
    if (squares[index] || gameOver) return;
    if (mode === 'ai' && !xIsNext) return; // Block clicks during AI turn
    const next = squares.slice();
    next[index] = xIsNext ? 'X' : 'O';
    setSquares(next);
    setXIsNext(!xIsNext);
  }

  // PUBLIC_INTERFACE
  function handleRestart() {
    /** Reset the board to initial state */
    setSquares(Array(9).fill(null));
    setXIsNext(true);
    setPendingAi(false);
    lastOutcomeRef.current = null;
    // Reset confetti state for future wins
    try { if (typeof window !== 'undefined') { /* no-op placeholder */ } } catch {}
  }

  function handleModeChange(e) {
    const val = e.target.value;
    if (val === mode) return;
    // Reset on mode switch to avoid inconsistencies
    handleRestart();
    setMode(val);
  }

  function handleDifficultyChange(e) {
    const val = e.target.value;
    if (val === difficulty) return;
    // Switching difficulty mid-game can lead to inconsistent AI planning - reset
    handleRestart();
    setDifficulty(val);
  }

  const isCellDisabled = (value) => {
    if (gameOver) return true;
    if (value) return true;
    if (mode === 'ai' && !xIsNext) return true; // Disable during AI (O) turn
    if (pendingAi) return true;
    return false;
  };

  const toggleSound = () => setSoundOn((s) => !s);

  useEffect(() => {
    try {
      localStorage.setItem('ttt-sound', soundOn ? 'on' : 'off');
    } catch {
      // ignore persistence errors
    }
  }, [soundOn]);

  // Helper to render a minimal icon without changing test-visible text
  const SoundIcon = ({ on }) => (
    <span className="icon" aria-hidden="true">
      {on ? '🔊' : '🔇'}
    </span>
  );

  // PUBLIC_INTERFACE
  function toggleTheme() {
    /** Toggle light/dark theme and persist the choice */
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <div className="app-root">
      <main className="container" role="main">
        <h1 className="title">Tic Tac Toe game</h1>

        <div className="controls" aria-label="controls">
          <div className="selectors" role="group" aria-label="Game mode">
            <label className="select">
              <span className="select-label">Mode</span>
              <select
                aria-label="Select mode"
                value={mode}
                onChange={handleModeChange}
              >
                <option value="2p">2 Players</option>
                <option value="ai">Vs AI</option>
              </select>
            </label>

            {mode === 'ai' && (
              <label className="select">
                <span className="select-label">Difficulty</span>
                <select
                  aria-label="Select difficulty"
                  value={difficulty}
                  onChange={handleDifficultyChange}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            )}
          </div>

          <div className="inline-actions" role="group" aria-label="App settings">
            <button
              type="button"
              className="sound-toggle"
              onClick={toggleSound}
              aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
              title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
            >
              <SoundIcon on={soundOn} />
              <span className="label">{soundOn ? 'Sound on' : 'Sound off'}</span>
            </button>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <span className="icon" aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span className="label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="scoreboard" role="group" aria-label="Scoreboard">
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">X</span>
            <span className="score-value" aria-label="X score">{scores.x}</span>
          </div>
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">O</span>
            <span className="score-value" aria-label="O score">{scores.o}</span>
          </div>
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">Draws</span>
            <span className="score-value" aria-label="Draws score">{scores.draws}</span>
          </div>
          <button
            type="button"
            className="reset-scores"
            onClick={resetScores}
            aria-label="Reset scores"
            title="Reset scores"
          >
            Reset Scores
          </button>
        </div>

        <div
          className={`status ${outcome === 'X' ? 'status-win' : outcome === 'O' ? 'status-win' : outcome === 'Draw' ? 'status-draw' : ''}`}
          aria-live="polite"
        >
          {statusText}
        </div>

        <div className="board" role="grid" aria-label="tic tac toe board">
          {squares.map((value, idx) => {
            const label = `cell ${idx + 1}`;
            const disabled = isCellDisabled(value);

            const isWinningCell =
              (outcome === 'X' || outcome === 'O') &&
              Array.isArray(winningLine) &&
              winningLine.includes(idx);

            const handleActivate = (e) => {
              if (disabled) return;
              const btn = e.currentTarget;
              btn.classList.add('square-pressing');
              window.requestAnimationFrame(() => {
                setTimeout(() => btn.classList.remove('square-pressing'), 120);
              });
            };

            const handleKeyDown = (e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                if (e.key === ' ') e.preventDefault();
                handleActivate(e);
              }
            };

            const onClick = (e) => {
              if (disabled) return;

              // Play click sound only for human action when a move will be placed.
              // Human clicks are the only triggers that reach here while enabled.
              if (soundOn && (mode === '2p' || (mode === 'ai' && xIsNext))) {
                const a = clickAudioRef.current || new Audio(clickSfx);
                clickAudioRef.current = a;
                try {
                  a.currentTime = 0;
                } catch {}
                const p = a.play();
                if (p && typeof p.catch === 'function') {
                  p.catch(() => {});
                }
              }

              handleSquareClick(idx);
              const btn = e.currentTarget;
              btn.classList.add('square-placed');
              setTimeout(() => {
                btn.classList.remove('square-placed');
              }, 200);
            };

            const onMouseDown = (e) => {
              if (disabled) return;
              handleActivate(e);
            };

            return (
              <button
                key={idx}
                type="button"
                className={`square${isWinningCell ? ' square-win' : ''}`}
                data-winning={isWinningCell ? 'true' : 'false'}
                aria-label={label}
                aria-disabled={disabled ? 'true' : 'false'}
                disabled={disabled}
                onMouseDown={onMouseDown}
                onKeyDown={handleKeyDown}
                onClick={onClick}
              >
                {value}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="restart"
          onClick={handleRestart}
          aria-label="Restart game"
        >
          Restart
        </button>
      </main>
    </div>
  );
}
