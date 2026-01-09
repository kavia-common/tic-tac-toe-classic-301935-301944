import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

import AboutDialog from './components/AboutDialog';
import pkg from '../package.json';

/**
 * Global keyboard shortcut keys supported by the app.
 * Note: We intentionally do not surface these strings via i18n to avoid
 * changing any visible labels or impacting existing tests.
 */
const KEY_SHORTCUTS = {
  restart: 'r',
  sound: 's',
  theme: 't',
};

/**
 * Returns true if the current active element is a typing surface where global
 * shortcuts should not interfere (input/textarea/select or contenteditable).
 */
function isTypingTargetActive() {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  if (!el) return false;

  // contenteditable: either attribute or DOM property
  if (el.isContentEditable) return true;
  const tag = (el.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Compute the winner of a tic-tac-toe board for an NxN grid.
 *
 * Win condition: a full line (row/col/diag) of the same symbol for the given size.
 * Returns an object:
 * - { winner: 'X'|'O', line: number[] } when there is a winner
 * - { winner: 'Draw', line: null } when all filled without a winner
 * - { winner: null, line: null } when game is in progress
 *
 * This allows the UI to highlight the exact winning line (N cells).
 */
function evaluateBoardDetailed(squares, size = 3) {
  const n = Number(size) || 3;

  // Build all winning lines dynamically (rows, cols, diagonals).
  const lines = [];

  // Rows
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(r * n + c);
    lines.push(row);
  }

  // Columns
  for (let c = 0; c < n; c++) {
    const col = [];
    for (let r = 0; r < n; r++) col.push(r * n + c);
    lines.push(col);
  }

  // Main diagonal
  const diag1 = [];
  for (let i = 0; i < n; i++) diag1.push(i * n + i);
  lines.push(diag1);

  // Anti-diagonal
  const diag2 = [];
  for (let i = 0; i < n; i++) diag2.push(i * n + (n - 1 - i));
  lines.push(diag2);

  for (const line of lines) {
    const firstIdx = line[0];
    const firstVal = squares[firstIdx];
    if (!firstVal) continue;

    let ok = true;
    for (let k = 1; k < line.length; k++) {
      if (squares[line[k]] !== firstVal) {
        ok = false;
        break;
      }
    }
    if (ok) return { winner: firstVal, line };
  }

  if (squares.length === n * n && squares.every(Boolean)) return { winner: 'Draw', line: null };
  return { winner: null, line: null };
}

/**
 * Backward-compatible simple evaluation for AI helpers and quick checks.
 * Returns:
 * - 'X' or 'O' if there is a winner
 * - 'Draw' if all cells are filled and no winner
 * - null if the game is still in progress
 */
function evaluateBoard(squares, size = 3) {
  const res = evaluateBoardDetailed(squares, size);
  return res.winner;
}

/**
 * AI helpers (work for any NxN size, but minimax is only used for 3x3).
 */
function getAvailableMoves(sq) {
  const m = [];
  for (let i = 0; i < sq.length; i++) if (!sq[i]) m.push(i);
  return m;
}

function randomMove(sq) {
  const moves = getAvailableMoves(sq);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

function canWinNextMove(sq, player, size) {
  const moves = getAvailableMoves(sq);
  for (const i of moves) {
    const copy = sq.slice();
    copy[i] = player;
    if (evaluateBoard(copy, size) === player) return i;
  }
  return null;
}

function pickCorner(sq, size) {
  // Corners for NxN: (0,0), (0,n-1), (n-1,0), (n-1,n-1)
  const n = Number(size) || 3;
  const corners = [0, n - 1, (n - 1) * n, n * n - 1].filter((i) => !sq[i]);
  if (corners.length === 0) return null;
  return corners[Math.floor(Math.random() * corners.length)];
}

// Minimax for 3x3 tic-tac-toe only, AI is 'O', human is 'X'
function minimax(sq, isMaximizing) {
  const result = evaluateBoard(sq, 3);
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

function getAiMove(sq, difficulty, size) {
  const n = Number(size) || 3;

  // Easy: random
  if (difficulty === 'easy') {
    return randomMove(sq);
  }

  // Medium: intentionally imperfect heuristic.
  // Goal: make Medium feel a bit easier without changing Easy/Hard.
  //
  // Strategy:
  // - Only take immediate wins/blocks some of the time.
  // - Otherwise, prefer "weaker but valid" moves (sides/random), with a small chance to still take center/corners.
  // This works across 3x3, 4x4, 5x5.
  if (difficulty === 'medium') {
    const available = getAvailableMoves(sq);
    if (available.length === 0) return null;

    // Tunable imperfection factor:
    // - 0.65 means: 65% chance to play an immediate win or an immediate block (when available),
    //   otherwise skip it and play a less optimal move.
    const TACTICAL_PROB = 0.65;

    // Helper: sides are non-corner edge cells (only meaningful for n>=3).
    const pickSide = () => {
      const sides = [];
      if (n < 3) return null;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const idx = r * n + c;
          if (sq[idx]) continue;

          const isCorner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
          const isEdge = r === 0 || r === n - 1 || c === 0 || c === n - 1;

          if (isEdge && !isCorner) sides.push(idx);
        }
      }

      if (sides.length === 0) return null;
      return sides[Math.floor(Math.random() * sides.length)];
    };

    // 1) Sometimes: take immediate win
    const win = canWinNextMove(sq, 'O', n);
    if (win !== null && Math.random() < TACTICAL_PROB) return win;

    // 2) Sometimes: block immediate loss
    const block = canWinNextMove(sq, 'X', n);
    if (block !== null && Math.random() < TACTICAL_PROB) return block;

    // 3) Otherwise, play a less optimal but valid move more often.
    // Prefer side moves to reduce strength on 3x3 and remain consistent for larger boards.
    const side = pickSide();
    if (side !== null && Math.random() < 0.6) return side;

    // 4) Occasionally still take center on odd sizes (keeps Medium from feeling "broken")
    if (n % 2 === 1 && Math.random() < 0.35) {
      const center = Math.floor((n * n) / 2);
      if (!sq[center]) return center;
    }

    // 5) Occasionally take a corner; otherwise random.
    const corner = pickCorner(sq, n);
    if (corner !== null && Math.random() < 0.5) return corner;

    return randomMove(sq);
  }

  // Hard: minimax optimal for 3x3 only.
  // For 5x5, minimax would be far too expensive; we gracefully fallback to Medium heuristics.
  // For 4x4 we also avoid minimax (still large branching). This keeps gameplay responsive.
  if (n !== 3) {
    // Minimal documentation required by task: Hard fallback for larger boards.
    return getAiMove(sq, 'medium', n);
  }

  const { move } = minimax(sq, true);
  return move ?? randomMove(sq);
}

/**
 * Best-of-N helpers.
 */
function clampSeriesN(n) {
  const allowed = [3, 5, 7];
  const parsed = Number(n);
  if (!Number.isFinite(parsed)) return 3;
  if (allowed.includes(parsed)) return parsed;
  return 3;
}

function seriesThreshold(n) {
  // Best-of-N: first to ceil(N/2)
  return Math.ceil(n / 2);
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * A note on audio/autoplay:
 * We create the Audio element lazily and "unlock" it on first user interaction
 * (click/keydown) so that browsers allow playback. We also guard to play the
 * draw sound only once per game by tracking last outcome.
 */
// PUBLIC_INTERFACE
export default function App() {
  const { t, i18n } = useTranslation();

  // Board size selector (experimental): 3x3 (default), 4x4, 5x5.
  // Note: Size affects win detection and AI; scoreboard stays global as requested.
  const [boardSize, setBoardSize] = useState(3);

  /** The NxN board cells; values are 'X', 'O', or null */
  const [squares, setSquares] = useState(() => Array(3 * 3).fill(null));
  /** True if it's X's turn, false for O's turn */
  const [xIsNext, setXIsNext] = useState(true);

  /**
   * Move history (time-travel) is tracked per-round only and is never persisted.
   * Each entry represents the board state AFTER a move is applied.
   *
   * - history[0] is the initial empty board
   * - currentHistoryIndex points to the state currently being viewed
   */
  const [history, setHistory] = useState(() => [
    {
      squares: Array(3 * 3).fill(null),
      // meta for move that produced this state; null for initial state
      move: null,
      xIsNext: true,
    },
  ]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  const viewingPast = currentHistoryIndex !== history.length - 1;

  const goToLatest = () => {
    // Return to latest state; resume play from that state.
    setCurrentHistoryIndex((_) => history.length - 1);
  };

  const goToHistoryIndex = (idx) => {
    if (!Number.isInteger(idx)) return;
    if (idx < 0 || idx >= history.length) return;
    setCurrentHistoryIndex(idx);
  };

  // Mode and difficulty
  const [mode, setMode] = useState('2p'); // '2p' | 'ai'
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [pendingAi, setPendingAi] = useState(false);

  // About dialog state
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutButtonRef = useRef(null);

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

  // Palette state (colorblind-friendly accent palettes). Persisted independently of theme.
  const PALETTE_STORAGE_KEY = 'ttt-palette';
  const getInitialPalette = () => {
    try {
      const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
      // 'default' preserves current golden (light) + existing dark theme look as the default palette set.
      if (saved === 'default' || saved === 'deuteranopia' || saved === 'tritanopia') return saved;
    } catch {
      // ignore
    }
    return 'default';
  };
  const [palette, setPalette] = useState(getInitialPalette);

  // SERIES MODE state (best-of-N)
  // Persisted keys:
  // - ttt-series-enabled: "on" | "off"
  // - ttt-series-n: "3" | "5" | "7"
  // - ttt-series-state: JSON { inProgress, locked, seriesWins:{x,o}, round:number, seriesWinner:null|'X'|'O' }
  const [seriesEnabled, setSeriesEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('ttt-series-enabled');
      if (v === 'on') return true;
      if (v === 'off') return false;
    } catch {}
    return false;
  });

  const [seriesN, setSeriesN] = useState(() => {
    try {
      return clampSeriesN(localStorage.getItem('ttt-series-n') ?? 3);
    } catch {
      return 3;
    }
  });

  const [seriesState, setSeriesState] = useState(() => {
    try {
      const raw = localStorage.getItem('ttt-series-state');
      const parsed = safeParseJson(raw);
      if (!parsed) {
        return {
          inProgress: false,
          locked: false,
          seriesWins: { x: 0, o: 0 },
          round: 1,
          seriesWinner: null,
        };
      }
      const inProgress = Boolean(parsed.inProgress);
      const locked = Boolean(parsed.locked);
      const x = Number.isFinite(parsed?.seriesWins?.x) ? parsed.seriesWins.x : 0;
      const o = Number.isFinite(parsed?.seriesWins?.o) ? parsed.seriesWins.o : 0;
      const round = Number.isFinite(parsed?.round) && parsed.round >= 1 ? parsed.round : 1;
      const seriesWinner = parsed?.seriesWinner === 'X' || parsed?.seriesWinner === 'O' ? parsed.seriesWinner : null;
      return {
        inProgress,
        locked,
        seriesWins: { x, o },
        round,
        seriesWinner,
      };
    } catch {
      return {
        inProgress: false,
        locked: false,
        seriesWins: { x: 0, o: 0 },
        round: 1,
        seriesWinner: null,
      };
    }
  });

  // Apply theme to document element and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ttt-theme', theme);
    } catch {
      // ignore persistence errors
    }
  }, [theme]);

  // Apply palette to document element and persist.
  // Note: we store 'default' explicitly to keep behavior deterministic across reloads.
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, palette);
    } catch {
      // ignore persistence errors
    }
  }, [palette]);

  // Persist series mode toggle and N and in-progress state
  useEffect(() => {
    try {
      localStorage.setItem('ttt-series-enabled', seriesEnabled ? 'on' : 'off');
    } catch {
      // ignore
    }
  }, [seriesEnabled]);

  /**
   * IMPORTANT (TDZ fix):
   * These callbacks are referenced by the global keyboard shortcuts effect below.
   * They must be initialized before that effect runs during render, otherwise a
   * temporal-dead-zone error can occur (e.g., "Cannot access 'toggleSound' before initialization").
   */

  const toggleSound = useCallback(() => {
    setSoundOn((s) => !s);
  }, []);

  // PUBLIC_INTERFACE
  const toggleTheme = useCallback(() => {
    /** Toggle light/dark theme and persist the choice */
    setTheme((th) => (th === 'dark' ? 'light' : 'dark'));
  }, []);

  // PUBLIC_INTERFACE
  const handleRestart = useCallback(() => {
    /** Reset the board to initial state (per-round restart; does not modify series state) */
    const empty = Array(boardSize * boardSize).fill(null);
    setSquares(empty);
    setXIsNext(true);
    setPendingAi(false);

    // Clear per-round history (requirement: restart clears history; no persistence between rounds).
    setHistory([{ squares: empty, move: null, xIsNext: true }]);
    setCurrentHistoryIndex(0);

    lastOutcomeRef.current = null;
    prevOutcomeRef.current = null;
    prevSeriesOutcomeRef.current = null;
    // Confetti state is reset by effects when leaving win state.
    try { if (typeof window !== 'undefined') { /* no-op placeholder */ } } catch {}
  }, [boardSize]);

  // Global keyboard shortcuts:
  // - R: restart current round
  // - S: toggle sound
  // - T: toggle light/dark theme
  //
  // Requirements:
  // 1) Do not trigger when typing in input/textarea/select/contenteditable
  // 2) Avoid interfering with other keyboard interactions (ignore modifier combos)
  // 3) Reflect changes in existing UI state (sound/theme toggle, restart button)
  useEffect(() => {
    const onKeyDown = (e) => {
      // Ignore if user is typing or using a modifier combo (Ctrl/Cmd/Alt).
      if (isTypingTargetActive()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // We also avoid firing shortcuts while the About dialog is open to prevent
      // accidental changes while user is interacting with the modal.
      if (aboutOpen) return;

      const key = (e.key || '').toLowerCase();
      if (!key) return;

      if (key === KEY_SHORTCUTS.restart) {
        // Prevent potential browser "reload" behaviors in some contexts.
        e.preventDefault();
        handleRestart();
      } else if (key === KEY_SHORTCUTS.sound) {
        e.preventDefault();
        toggleSound();
      } else if (key === KEY_SHORTCUTS.theme) {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aboutOpen, handleRestart, toggleTheme, toggleSound]);

  useEffect(() => {
    try {
      localStorage.setItem('ttt-series-n', String(seriesN));
    } catch {
      // ignore
    }
  }, [seriesN]);

  useEffect(() => {
    try {
      localStorage.setItem('ttt-series-state', JSON.stringify(seriesState));
    } catch {
      // ignore
    }
  }, [seriesState]);

  const boardCellCount = boardSize * boardSize;

  // Determine game status with winning line info (NxN) for the currently viewed state.
  const evaluation = useMemo(() => evaluateBoardDetailed(squares, boardSize), [squares, boardSize]);
  const outcome = evaluation.winner;
  const winningLine = evaluation.line; // null for draw or in-progress
  const gameOver = outcome === 'X' || outcome === 'O' || outcome === 'Draw';

  const currentPlayer = xIsNext ? 'X' : 'O';
  const seriesInProgress = seriesEnabled && seriesState.inProgress;
  const seriesLocked = seriesInProgress && seriesState.locked;
  const neededToWinSeries = useMemo(() => seriesThreshold(seriesN), [seriesN]);

  // Only allow round completion side-effects (score increments, series increments, win/draw sounds/confetti)
  // when the user is viewing the latest move.
  const allowRoundEffects = !viewingPast;

  // Series score should only be visible/meaningful when series is enabled.
  const seriesStatusText = useMemo(() => {
    if (!seriesEnabled) return null;

    if (!seriesState.inProgress) {
      return t('series.notStarted', { n: seriesN, threshold: neededToWinSeries });
    }

    if (seriesState.seriesWinner) {
      return t('series.winner', { player: seriesState.seriesWinner, x: seriesState.seriesWins.x, o: seriesState.seriesWins.o });
    }

    return t('series.inProgress', {
      n: seriesN,
      round: seriesState.round,
      threshold: neededToWinSeries,
      x: seriesState.seriesWins.x,
      o: seriesState.seriesWins.o,
    });
  }, [seriesEnabled, seriesState, seriesN, neededToWinSeries, t]);

  const statusText = useMemo(() => {
    // If series winner has been decided, show a series-specific message and keep board locked.
    if (seriesLocked && seriesState.seriesWinner) {
      return t('series.winner', { player: seriesState.seriesWinner, x: seriesState.seriesWins.x, o: seriesState.seriesWins.o });
    }

    if (outcome === 'X') return t('status.xWins');
    if (outcome === 'O') return t('status.oWins');
    if (outcome === 'Draw') return t('status.draw');
    return t('status.turn', { player: currentPlayer });
  }, [outcome, currentPlayer, t, seriesLocked, seriesState]);

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

  // Increment appropriate persistent score when a game ends
  const prevOutcomeRef = useRef(null);
  useEffect(() => {
    if (!allowRoundEffects) return;
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
  }, [allowRoundEffects, gameOver, outcome]);

  // Update series score at end of round (only when in a series).
  const prevSeriesOutcomeRef = useRef(null);
  useEffect(() => {
    if (!seriesInProgress) {
      prevSeriesOutcomeRef.current = null;
      return;
    }
    if (!allowRoundEffects) return;
    if (!gameOver) return;
    if (prevSeriesOutcomeRef.current === outcome) return;

    prevSeriesOutcomeRef.current = outcome;

    if (outcome === 'X' || outcome === 'O') {
      setSeriesState((s) => {
        if (!s.inProgress || s.locked) return s;

        const nextWins = { ...s.seriesWins };
        if (outcome === 'X') nextWins.x += 1;
        if (outcome === 'O') nextWins.o += 1;

        const threshold = seriesThreshold(seriesN);
        const xReached = nextWins.x >= threshold;
        const oReached = nextWins.o >= threshold;
        const seriesWinner = xReached ? 'X' : oReached ? 'O' : null;

        return {
          ...s,
          seriesWins: nextWins,
          locked: Boolean(seriesWinner), // lock immediately when threshold reached
          seriesWinner,
        };
      });
    }
    // Draws do not count towards series threshold
  }, [seriesInProgress, allowRoundEffects, gameOver, outcome, seriesN]);

  // Trigger confetti for series win (separate from per-round win)
  const seriesConfettiLaunchedRef = useRef(false);
  useEffect(() => {
    if (!seriesInProgress) {
      seriesConfettiLaunchedRef.current = false;
      return;
    }
    if (!allowRoundEffects) {
      seriesConfettiLaunchedRef.current = false;
      return;
    }
    if (!seriesState.seriesWinner) {
      seriesConfettiLaunchedRef.current = false;
      return;
    }
    if (seriesConfettiLaunchedRef.current) return;

    seriesConfettiLaunchedRef.current = true;

    // Respect theme by using accent colors that look good on both themes.
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = isDark
      ? ['#60a5fa', '#22d3ee', '#ffffff']
      : ['#f59e0b', '#fbbf24', '#06b6d4'];

    // Bigger burst than per-round to signal series victory.
    const defaults = { spread: 80, ticks: 160, gravity: 0.85, scalar: 1.0, colors };
    confetti({ ...defaults, particleCount: 90, origin: { y: 0.25 } });
    setTimeout(() => confetti({ ...defaults, particleCount: 120, origin: { y: 0.2 } }), 160);
    setTimeout(() => confetti({ ...defaults, particleCount: 140, origin: { y: 0.18 } }), 320);
  }, [seriesInProgress, allowRoundEffects, seriesState.seriesWinner, seriesState.seriesWins]);

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
    if (!allowRoundEffects) return;
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
  }, [allowRoundEffects, outcome, soundOn]);

  // Play win sound once when transitioning to a winner (X or O) and trigger confetti
  const confettiLaunchedRef = useRef(false);

  useEffect(() => {
    if (!allowRoundEffects) return;

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
  }, [allowRoundEffects, outcome, soundOn]);

  // Trigger AI move after human 'X' moves in Vs AI mode, if game not over (and series not locked)
  // NOTE: AI is disabled while viewing past history states; it resumes only on the latest move.
  useEffect(() => {
    if (mode !== 'ai') {
      setPendingAi(false);
      return;
    }
    if (viewingPast) {
      setPendingAi(false);
      return;
    }
    if (gameOver) {
      setPendingAi(false);
      return;
    }
    if (seriesLocked) {
      setPendingAi(false);
      return;
    }
    // AI plays as 'O' when it's O's turn
    if (!xIsNext) {
      // Guard UI (disable human input) by marking pending
      setPendingAi(true);
      // small delay for UX; also allows animation frame to settle
      const tmr = setTimeout(() => {
        setPendingAi(false);
        setSquares((prev) => {
          // Double-check not ended and still O's turn for consistency
          if (evaluateBoard(prev, boardSize)) return prev;
          if (seriesLocked) return prev;
          const move = getAiMove(prev, difficulty, boardSize);
          if (move === null || prev[move]) return prev;
          const next = prev.slice();
          next[move] = 'O';

          // Record AI move in history (only when not time-traveling; effect is guarded above).
          const moveNumber = currentHistoryIndex + 1;
          setHistory((h) => [
            ...h,
            { squares: next, move: { index: move, player: 'O', moveNumber }, xIsNext: true },
          ]);
          setCurrentHistoryIndex((_) => currentHistoryIndex + 1);

          return next;
        });
        setXIsNext(true); // After AI (O), next is X
      }, 250);
      return () => clearTimeout(tmr);
    }
  }, [mode, xIsNext, squares, difficulty, gameOver, seriesLocked, viewingPast]);

  // PUBLIC_INTERFACE
  function handleSquareClick(index) {
    /** Handle a move: ignore if filled or game over or series locked or AI turn */
    if (!Number.isInteger(index) || index < 0 || index >= squares.length) return;
    if (squares[index] || gameOver) return;
    if (seriesLocked) return;
    if (mode === 'ai' && !xIsNext) return; // Block clicks during AI turn
    if (pendingAi) return;

    const player = xIsNext ? 'X' : 'O';
    const moveNumber = currentHistoryIndex + 1; // since index 0 is "start"
    const nextSquares = squares.slice();
    nextSquares[index] = player;

    // If user is time-traveling and then plays a move, truncate future history (branching).
    setHistory((h) => {
      const base = h.slice(0, currentHistoryIndex + 1);
      return [
        ...base,
        {
          squares: nextSquares,
          move: { index, player, moveNumber },
          xIsNext: !xIsNext,
        },
      ];
    });

    // Advance to latest state
    setCurrentHistoryIndex((_) => currentHistoryIndex + 1);

    setSquares(nextSquares);
    setXIsNext(!xIsNext);
  }

  // Keep currently-viewed state in sync with the time-travel index.
  useEffect(() => {
    const entry = history[currentHistoryIndex];
    if (!entry) return;

    // Sync only if different to avoid redundant renders.
    setSquares(entry.squares);
    setXIsNext(entry.xIsNext);

    // If time-traveling, ensure AI is not "pending".
    if (currentHistoryIndex !== history.length - 1) {
      setPendingAi(false);
    }
  }, [currentHistoryIndex, history]);

  function handleBoardSizeChange(e) {
    const nextSize = Number(e.target.value);
    if (![3, 4, 5].includes(nextSize)) return;
    if (nextSize === boardSize) return;

    // Requirement: do not mix series/stats across sizes. Easiest path:
    // - restart current round on size change
    // - end current series (if any) so user can start a new one under the new size
    setBoardSize(nextSize);

    // End series unconditionally (clears in-series state and restarts board).
    // This does not touch the persistent overall scoreboard.
    setSeriesEnabled(false);
    setSeriesState({
      inProgress: false,
      locked: false,
      seriesWins: { x: 0, o: 0 },
      round: 1,
      seriesWinner: null,
    });

    // Reset round state + board for new size.
    const empty = Array(nextSize * nextSize).fill(null);
    setSquares(empty);
    setXIsNext(true);
    setPendingAi(false);

    // Reset per-round history for the new size.
    setHistory([{ squares: empty, move: null, xIsNext: true }]);
    setCurrentHistoryIndex(0);

    lastOutcomeRef.current = null;
    prevOutcomeRef.current = null;
    prevSeriesOutcomeRef.current = null;
  }

  // PUBLIC_INTERFACE
  function startSeries() {
    /** Start a new series; reset in-series score and round without affecting global persistent scores. */
    setSeriesState({
      inProgress: true,
      locked: false,
      seriesWins: { x: 0, o: 0 },
      round: 1,
      seriesWinner: null,
    });
    // Start series from a clean board
    handleRestart();
  }

  // PUBLIC_INTERFACE
  function endSeries() {
    /** End the current series; clears in-series state without affecting global persistent scores. */
    setSeriesState({
      inProgress: false,
      locked: false,
      seriesWins: { x: 0, o: 0 },
      round: 1,
      seriesWinner: null,
    });
    handleRestart();
  }

  // PUBLIC_INTERFACE
  function nextRound() {
    /** Advance to next round within an active series; resets only the board/turn and increments round counter. */
    setSeriesState((s) => {
      if (!s.inProgress) return s;
      if (s.locked) return s; // series decided
      return { ...s, round: s.round + 1 };
    });
    handleRestart();
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

  function handleSeriesToggle(e) {
    const on = e.target.checked;
    setSeriesEnabled(on);
    // If turning off, also end/clear the series state so refresh doesn't "keep" it in the background.
    if (!on) {
      endSeries();
    }
  }

  function handleSeriesNChange(e) {
    const n = clampSeriesN(e.target.value);
    setSeriesN(n);
    // If a series is already in progress, keep its current state but re-check lock condition
    // in case user changes N mid-series; we choose to keep existing wins but recompute threshold.
    setSeriesState((s) => {
      if (!s.inProgress) return s;
      const threshold = seriesThreshold(n);
      const xReached = s.seriesWins.x >= threshold;
      const oReached = s.seriesWins.o >= threshold;
      const seriesWinner = xReached ? 'X' : oReached ? 'O' : null;
      return {
        ...s,
        locked: Boolean(seriesWinner),
        seriesWinner,
      };
    });
  }

  const isCellDisabled = (value) => {
    if (viewingPast) return true; // time-travel view is read-only
    if (seriesLocked) return true;
    if (gameOver) return true;
    if (value) return true;
    if (mode === 'ai' && !xIsNext) return true; // Disable during AI (O) turn
    if (pendingAi) return true;
    return false;
  };

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

  function handleLanguageChange(e) {
    const lng = e.target.value;
    if (!lng || lng === i18n.language) return;
    i18n.changeLanguage(lng);
  }

  const nextRoundEnabled = seriesInProgress && gameOver && !seriesLocked;
  const startSeriesEnabled = seriesEnabled && !seriesInProgress;
  const endSeriesEnabled = seriesEnabled && seriesInProgress;

  const appName = 'Tic Tac Toe';
  const appVersion = typeof pkg?.version === 'string' ? pkg.version : null;

  // PUBLIC_INTERFACE
  function openAbout() {
    /** Open About dialog and let the modal handle focus management. */
    setAboutOpen(true);
  }

  // PUBLIC_INTERFACE
  function closeAbout() {
    /** Close About dialog and restore focus to the About button. */
    setAboutOpen(false);
    // AboutDialog also restores focus to previously focused element; this is a safe extra.
    window.setTimeout(() => {
      aboutButtonRef.current?.focus?.();
    }, 0);
  }

  return (
    <div className="app-root">
      <main className="container" role="main">
        <h1 className="title" data-testid="app-title">{t('app.title')}</h1>

        <div className="controls" aria-label={t('controls.controlsAria')}>
          <div className="selectors" role="group" aria-label={t('controls.gameModeAria')}>
            <label className="select">
              <span className="select-label">{t('selectors.mode')}</span>
              <select
                aria-label={t('selectors.selectMode')}
                value={mode}
                onChange={handleModeChange}
              >
                <option value="2p">{t('modes.twoPlayers')}</option>
                <option value="ai">{t('modes.vsAi')}</option>
              </select>
            </label>

            {mode === 'ai' && (
              <label className="select">
                <span className="select-label">{t('selectors.difficulty')}</span>
                <select
                  aria-label={t('selectors.selectDifficulty')}
                  value={difficulty}
                  onChange={handleDifficultyChange}
                >
                  <option value="easy">{t('difficulties.easy')}</option>
                  <option value="medium">{t('difficulties.medium')}</option>
                  <option value="hard">{t('difficulties.hard')}</option>
                </select>
              </label>
            )}

            <label className="select">
              <span className="select-label">{t('selectors.size')}</span>
              <select
                aria-label={t('selectors.selectSize')}
                value={boardSize}
                onChange={handleBoardSizeChange}
              >
                <option value={3}>{t('sizes.size3')}</option>
                <option value={4}>{t('sizes.size4')}</option>
                <option value={5}>{t('sizes.size5')}</option>
              </select>
            </label>
          </div>

          <div className="inline-actions" role="group" aria-label={t('controls.appSettingsAria')}>
            <label className="select language-select">
              <span className="select-label">{t('controls.language')}</span>
              <select
                aria-label={t('controls.selectLanguage')}
                value={i18n.language}
                onChange={handleLanguageChange}
                data-testid="language-select"
              >
                <option value="en">{t('languages.en')}</option>
                <option value="es">{t('languages.es')}</option>
                <option value="pt">{t('languages.pt')}</option>
              </select>
            </label>

            <label className="select palette-select">
              <span className="select-label">{t('palette.label')}</span>
              <select
                aria-label={t('palette.selectAria')}
                value={palette}
                onChange={(e) => setPalette(e.target.value)}
                data-testid="palette-select"
              >
                <option value="default">{t('palette.options.default')}</option>
                <option value="deuteranopia">{t('palette.options.deuteranopia')}</option>
                <option value="tritanopia">{t('palette.options.tritanopia')}</option>
              </select>
            </label>

            <button
              type="button"
              className="sound-toggle"
              onClick={toggleSound}
              aria-label={soundOn ? t('controls.muteSounds') : t('controls.unmuteSounds')}
              // Keep visible text unchanged; add shortcut hint only via title.
              title={`${soundOn ? t('controls.muteSounds') : t('controls.unmuteSounds')} (S)`}
              data-testid="sound-toggle"
            >
              <SoundIcon on={soundOn} />
              <span className="label">{soundOn ? t('controls.soundOn') : t('controls.soundOff')}</span>
            </button>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('controls.switchToLightTheme') : t('controls.switchToDarkTheme')}
              // Keep visible text unchanged; add shortcut hint only via title.
              title={`${theme === 'dark' ? t('controls.switchToLightTheme') : t('controls.switchToDarkTheme')} (T)`}
              data-testid="theme-toggle"
            >
              <span className="icon" aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span className="label">{theme === 'dark' ? t('controls.themeDark') : t('controls.themeLight')}</span>
            </button>

            <button
              ref={aboutButtonRef}
              type="button"
              className="about-btn"
              onClick={openAbout}
              aria-label={t('about.openAria')}
              title={t('about.openAria')}
              data-testid="about-button"
            >
              <span className="icon" aria-hidden="true">i</span>
              <span className="label">{t('about.open')}</span>
            </button>
          </div>
        </div>

        {/* Series controls */}
        <section className="series-panel" aria-label={t('series.panelAria')}>
          <div className="series-row">
            <label className="series-toggle">
              <input
                type="checkbox"
                checked={seriesEnabled}
                onChange={handleSeriesToggle}
                aria-label={t('series.toggleAria')}
              />
              <span className="series-toggle-text">{t('series.toggleLabel')}</span>
            </label>

            <label className="select series-select">
              <span className="select-label">{t('series.bestOf')}</span>
              <select
                aria-label={t('series.bestOfAria')}
                value={seriesN}
                onChange={handleSeriesNChange}
                disabled={seriesInProgress} // avoid changing N mid-series by default
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={7}>7</option>
              </select>
            </label>
          </div>

          <div className="series-actions" role="group" aria-label={t('series.actionsAria')}>
            <button
              type="button"
              className="series-btn series-btn-primary"
              onClick={startSeries}
              disabled={!startSeriesEnabled}
              aria-label={t('series.startAria')}
            >
              {t('series.start')}
            </button>

            <button
              type="button"
              className="series-btn"
              onClick={nextRound}
              disabled={!nextRoundEnabled}
              aria-label={t('series.nextRoundAria')}
            >
              {t('series.nextRound')}
            </button>

            <button
              type="button"
              className="series-btn series-btn-danger"
              onClick={endSeries}
              disabled={!endSeriesEnabled}
              aria-label={t('series.endAria')}
            >
              {t('series.end')}
            </button>
          </div>

          {seriesStatusText && (
            <div className={`series-status ${seriesLocked ? 'series-status-locked' : ''}`} aria-live="polite">
              {seriesStatusText}
            </div>
          )}

          {seriesEnabled && seriesInProgress && (
            <div className="series-score" role="group" aria-label={t('series.scoreAria')}>
              <div className="score">
                <span className="score-label" aria-hidden="true">X</span>
                <span className="score-value" aria-label={t('series.xWinsAria')}>{seriesState.seriesWins.x}</span>
              </div>
              <div className="score">
                <span className="score-label" aria-hidden="true">O</span>
                <span className="score-value" aria-label={t('series.oWinsAria')}>{seriesState.seriesWins.o}</span>
              </div>
              <div className="series-threshold" aria-label={t('series.thresholdAria', { threshold: neededToWinSeries })}>
                {t('series.firstTo', { threshold: neededToWinSeries })}
              </div>
            </div>
          )}
        </section>

        {/* Scoreboard */}
        <div className="scoreboard" role="group" aria-label={t('controls.scoreboardAria')}>
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">X</span>
            <span className="score-value" aria-label={t('scoreboard.xScoreAria')}>{scores.x}</span>
          </div>
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">O</span>
            <span className="score-value" aria-label={t('scoreboard.oScoreAria')}>{scores.o}</span>
          </div>
          <div className="score" aria-live="polite">
            <span className="score-label" aria-hidden="true">{t('scoreboard.draws')}</span>
            <span className="score-value" aria-label={t('scoreboard.drawsScoreAria')}>{scores.draws}</span>
          </div>
          <button
            type="button"
            className="reset-scores"
            onClick={resetScores}
            aria-label={t('scoreboard.resetScoresAria')}
            title={t('scoreboard.resetScoresAria')}
            data-testid="reset-scores"
          >
            {t('scoreboard.resetScores')}
          </button>
        </div>

        <div
          className={`status ${
            viewingPast
              ? 'status-draw'
              : seriesLocked
                ? 'status-win'
                : outcome === 'X'
                  ? 'status-win'
                  : outcome === 'O'
                    ? 'status-win'
                    : outcome === 'Draw'
                      ? 'status-draw'
                      : ''
          }`}
          aria-live="polite"
          data-testid="status-text"
        >
          {viewingPast ? t('history.viewingPast', { move: currentHistoryIndex }) : statusText}
        </div>

        {/* History (time-travel) */}
        <section className="history-panel" aria-label={t('history.panelAria')}>
          <div className="history-header">
            <div>
              <h2 className="history-title">{t('history.title')}</h2>
              <div className="history-subtitle" aria-live="polite">
                {t('history.subtitle', { current: currentHistoryIndex, total: Math.max(history.length - 1, 0) })}
              </div>
            </div>

            <div className="history-actions">
              <button
                type="button"
                className="goto-latest"
                onClick={goToLatest}
                disabled={!viewingPast}
                aria-label={t('history.gotoLatestAria')}
                data-testid="goto-latest"
              >
                {t('history.gotoLatest')}
              </button>
            </div>
          </div>

          <div className="history-list" data-testid="history-list">
            {history.map((entry, idx) => {
              const label =
                idx === 0
                  ? t('history.moveStart')
                  : t('history.moveItem', {
                      move: idx,
                      player: entry?.move?.player ?? '?',
                      cell: (entry?.move?.index ?? 0) + 1,
                    });

              return (
                <button
                  key={idx}
                  type="button"
                  className={`history-item${idx === currentHistoryIndex ? ' history-item-current' : ''}`}
                  onClick={() => goToHistoryIndex(idx)}
                  aria-label={t('history.gotoMoveAria', { move: idx }) + `: ${label}`}
                  data-testid={`history-item-${idx}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <div
          className="board"
          role="grid"
          aria-label={t('controls.boardAria')}
          aria-rowcount={boardSize}
          aria-colcount={boardSize}
          style={{ '--board-size': boardSize }}
        >
          {squares.map((value, idx) => {
            // Keep this aria-label stable for existing tests which query /cell \d+/i
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
                data-mark={value === 'X' ? 'x' : value === 'O' ? 'o' : ''}
                aria-label={label}
                aria-disabled={disabled ? 'true' : 'false'}
                disabled={disabled}
                onMouseDown={onMouseDown}
                onKeyDown={handleKeyDown}
                onClick={onClick}
                data-testid={`cell-${idx + 1}`}
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
          aria-label={t('controls.restartAria')}
          title={`${t('controls.restartAria')} (R)`}
          data-testid="restart-button"
        >
          {t('controls.restart')}
        </button>
      </main>

      <footer className="app-footer" aria-label={t('controls.footerAria')}>
        <small className="app-footer-text">@danielm</small>
      </footer>

      <AboutDialog
        open={aboutOpen}
        onClose={closeAbout}
        appName={appName}
        version={appVersion}
      />
    </div>
  );
}
