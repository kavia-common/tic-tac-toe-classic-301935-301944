import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function getCells() {
  // Cells are buttons with aria-label "cell N"
  return screen.getAllByRole('button', { name: /cell \d+/i });
}

describe('Tic-Tac-Toe App', () => {
  test('renders a 3x3 board with 9 cells and initial status', () => {
    render(<App />);
    const board = screen.getByRole('grid', { name: /tic tac toe board/i });
    expect(board).toBeInTheDocument();

    const cells = getCells();
    expect(cells).toHaveLength(9);
    cells.forEach((cell) => {
      // Empty content initially
      expect(cell).toHaveTextContent('');
      // Not disabled initially
      expect(cell).not.toBeDisabled();
    });

    // Initial status shows X turn (language-dependent text, but still includes X)
    expect(screen.getByTestId('status-text')).toHaveTextContent(/X/i);
  });

  test('clicking cells alternates X then O and updates status text', async () => {
    const user = userEvent.setup();
    render(<App />);

    const cells = getCells();
    const status = screen.getByTestId('status-text');

    // First move places X in cell 1
    await user.click(cells[0]);
    expect(cells[0]).toHaveTextContent('X');
    expect(cells[0]).toBeDisabled();
    expect(status).toHaveTextContent(/O/i);

    // Second move places O in cell 2
    await user.click(cells[1]);
    expect(cells[1]).toHaveTextContent('O');
    expect(status).toHaveTextContent(/X/i);
  });

  test('win detection shows a winner message when a winning line is formed', async () => {
    const user = userEvent.setup();
    render(<App />);
    const c = getCells();

    // Create a winning line for X on the top row: positions 0,1,2
    // X: 0
    await user.click(c[0]);
    // O: 3
    await user.click(c[3]);
    // X: 1
    await user.click(c[1]);
    // O: 4
    await user.click(c[4]);
    // X: 2 -> X wins
    await user.click(c[2]);

    // Status should indicate X won (language independent via marker)
    expect(screen.getByTestId('status-text')).toHaveTextContent(/X/i);

    // After win, all cells should be disabled (game over)
    c.forEach((cell) => {
      expect(cell).toBeDisabled();
    });
  });

  test('draw detection shows a draw message when the board is full with no winner', async () => {
    const user = userEvent.setup();
    render(<App />);
    const c = getCells();

    // Sequence for a draw:
    // X:0, O:1, X:2, O:4, X:3, O:5, X:7, O:6, X:8
    const sequence = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    for (const index of sequence) {
      await user.click(c[index]);
    }

    // Draw should not show a winner mark; ensure status contains 'draw' in EN default
    // (App defaults to browser language; tests run in en-US typically)
    expect(screen.getByTestId('status-text')).toHaveTextContent(/draw|empate/i);

    // All cells should be disabled after draw
    c.forEach((cell) => expect(cell).toBeDisabled());
  });

  test('restart button resets the board and status', async () => {
    const user = userEvent.setup();
    render(<App />);
    const c = getCells();

    // Make a couple of moves
    await user.click(c[0]); // X
    await user.click(c[1]); // O

    // Restart
    const restart = screen.getByTestId('restart-button');
    await user.click(restart);

    // Board reset: all cells empty and enabled
    const afterResetCells = getCells();
    afterResetCells.forEach((cell) => {
      expect(cell).toHaveTextContent('');
      expect(cell).not.toBeDisabled();
    });

    // Status back to X's turn (contains X regardless of language)
    expect(screen.getByTestId('status-text')).toHaveTextContent(/X/i);
  });
});
