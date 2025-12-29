import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import drawSfx from './assets/draw.mp3';

/**
 * Compute the winner of a tic-tac-toe board.
 * Returns:
 * - 'X' or 'O' if there is a winner
 * - 'Draw' if all cells are filled and no winner
 * - null if the game is still in progress
 */
function evaluateBoard(squares) {
  const lines = [
    // rows
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    // cols
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    // diags
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  if (squares.every(Boolean)) return 'Draw';
  return null;
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

  // Sound state
  const [soundOn, setSoundOn] = useState(true);
  const audioRef = useRef(null);
  const audioReadyRef = useRef(false);
  const lastOutcomeRef = useRef(null);

  // Determine game status
  const outcome = useMemo(() => evaluateBoard(squares), [squares]);
  const gameOver = outcome === 'X' || outcome === 'O' || outcome === 'Draw';

  const currentPlayer = xIsNext ? 'X' : 'O';
  const statusText = useMemo(() => {
    if (outcome === 'X') return 'X wins!';
    if (outcome === 'O') return 'O wins!';
    if (outcome === 'Draw') return "It's a draw.";
    return `Turn: ${currentPlayer}`;
  }, [outcome, currentPlayer]);

  // Prepare audio lazily on first user gesture
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(drawSfx);
        audioRef.current.preload = 'auto';
      }
      // Attempt a silent play/pause to satisfy autoplay policies
      const a = audioRef.current;
      // some browsers require actual play to unlock; we'll catch promise errors silently
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
          audioReadyRef.current = true;
        }).catch(() => {
          // If it fails, we'll still mark as ready and rely on next gesture when playing
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
          audioReadyRef.current = true;
        });
      } else {
        a.pause();
        a.currentTime = 0;
        a.volume = 1;
        audioReadyRef.current = true;
      }
      // We only need to unlock once
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
        const a = audioRef.current || new Audio(drawSfx);
        audioRef.current = a;
        // If not unlocked yet, this call will be triggered by the same interaction that finished the game
        // but we still guard with catch to avoid unhandled promise rejections in tests/headless.
        a.currentTime = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }
    } else if (outcome !== 'Draw') {
      // track other states so we can detect future transitions
      lastOutcomeRef.current = outcome;
    }
  }, [outcome, soundOn]);

  // PUBLIC_INTERFACE
  function handleSquareClick(index) {
    /** Handle a move: ignore if filled or game over */
    if (squares[index] || gameOver) return;
    const next = squares.slice();
    next[index] = currentPlayer;
    setSquares(next);
    setXIsNext(!xIsNext);
  }

  // PUBLIC_INTERFACE
  function handleRestart() {
    /** Reset the board to initial state */
    setSquares(Array(9).fill(null));
    setXIsNext(true);
    // Allow a future draw event to trigger sound again
    lastOutcomeRef.current = null;
  }

  const toggleSound = () => setSoundOn((s) => !s);

  // Helper to render a minimal icon without changing test-visible text
  const SoundIcon = ({ on }) => (
    <span className="icon" aria-hidden="true">
      {on ? '🔊' : '🔇'}
    </span>
  );

  return (
    <div className="app-root">
      <main className="container" role="main">
        <h1 className="title">Tic-Tac-Toe</h1>

        <div className="controls" aria-label="controls">
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
            const disabled = Boolean(value) || gameOver;

            // We use data attributes to help CSS hooks during tests; tests only check text/disabled.
            const handleActivate = (e) => {
              // Add a short "pressing" class to give immediate feedback for keyboard/mouse down
              const btn = e.currentTarget;
              btn.classList.add('square-pressing');
              // Remove pressing state shortly after to let CSS transition do the rest
              window.requestAnimationFrame(() => {
                setTimeout(() => btn.classList.remove('square-pressing'), 120);
              });
            };

            const handleKeyDown = (e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                // Prevent page scroll on Space
                if (e.key === ' ') e.preventDefault();
                handleActivate(e);
              }
            };

            const onClick = (e) => {
              if (disabled) return;
              handleSquareClick(idx);
              // If a mark was placed, briefly add a "placed" class for pop animation
              // This runs after state update; the button will become disabled but DOM remains for animation.
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
                className="square"
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
