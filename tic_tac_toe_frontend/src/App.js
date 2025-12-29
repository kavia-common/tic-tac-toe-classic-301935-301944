import React, { useMemo, useState } from 'react';
import './App.css';

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

// PUBLIC_INTERFACE
export default function App() {
  /** The 9 board cells; values are 'X', 'O', or null */
  const [squares, setSquares] = useState(Array(9).fill(null));
  /** True if it's X's turn, false for O's turn */
  const [xIsNext, setXIsNext] = useState(true);

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
  }

  return (
    <div className="app-root">
      <main className="container" role="main">
        <h1 className="title">Tic-Tac-Toe</h1>

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
            return (
              <button
                key={idx}
                type="button"
                className="square"
                aria-label={label}
                aria-disabled={disabled ? 'true' : 'false'}
                disabled={disabled}
                onClick={() => handleSquareClick(idx)}
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
