# Tic Tac Toe (React)

This project is a modern, single-page Tic Tac Toe experience built with React and vanilla CSS. It supports local multiplayer, multiple AI levels, optional series play, persistent scoring, theming, sound effects, and localization.

## Overview

The app renders a responsive NxN grid (3×3 by default) where players take turns placing X and O. It includes win/draw detection, a restart action, and several “quality of life” features such as sound, animations, theme switching, and an About dialog.

## Key Features

The game implements a full round lifecycle including turn-taking, move validation, win/draw detection, and restarting the board. When a player wins, the app highlights the full winning line (row/column/diagonal) and visually emphasizes it. Draws are detected when the board is full without a winner.

The app also maintains a persistent scoreboard (X wins, O wins, draws) in `localStorage`, and provides a Reset Scores button that clears only the scoreboard without affecting the current board.

## Gameplay Modes

The Mode selector supports the following:

- **2 Players (local multiplayer):** Two human players share the same device and alternate turns.
- **Vs AI:** The human plays **X** and the AI plays **O**. The UI prevents user input during the AI turn and introduces a small delay (about 250ms) so the AI move feels natural.

Changing Mode resets the current round to avoid inconsistent states.

## AI Levels

When playing Vs AI, there are three difficulties:

- **Easy:** Random valid move selection.
- **Medium:** A simple heuristic strategy: win if possible, otherwise block, otherwise take center (odd sizes only), otherwise take a corner, otherwise random.
- **Hard:** Uses **minimax** for **3×3 only** for optimal play. On larger boards (4×4 and 5×5), Hard intentionally falls back to the Medium heuristic to keep the game responsive.

Changing Difficulty resets the current round.

## Board Size Variants (Experimental)

A Size selector allows choosing:

- **3×3**
- **4×4 (Experimental)**
- **5×5 (Experimental)**

Win detection and winning-line highlighting work for NxN boards by generating all row/column/diagonal lines dynamically. The board layout uses a CSS grid controlled by a `--board-size` variable and adapts spacing and mark sizing for larger boards.

Changing board size resets the board and also turns off/clears Series mode state so users do not accidentally mix a series across different sizes.

## Series Mode (Best of N)

An optional **Series mode** (Best of **3 / 5 / 7**) is implemented with its own in-series score and round counter. When enabled:

- You can **Start Series**, then play consecutive rounds.
- After each round, X or O series wins increment on actual wins (draws do not count toward the series threshold).
- When a player reaches the “first to” threshold (ceil(N/2)), the series is locked and a series winner is announced.
- Series state is persisted in `localStorage` so it survives reloads.

Series controls are disabled/enabled to avoid invalid operations (for example, you cannot start a new series while one is already in progress). The “Best of” selector is disabled during an active series by default.

## Scoring and Persistence

The app persists the following values in `localStorage`:

- Sound toggle (`ttt-sound`)
- Theme (`ttt-theme`)
- Scoreboard (`ttt-scores`)
- Series mode enabled (`ttt-series-enabled`)
- Series length (`ttt-series-n`)
- Series in-progress state (`ttt-series-state`)
- Language (`ttt-lang`)

This enables the UI to restore user preferences across sessions without a backend.

## Theming (Light/Dark + Golden Palette)

The UI supports light and dark themes via CSS variables, controlled by a `data-theme` attribute on `<html>`. Theme selection is persisted.

The **light theme** uses a **golden palette** for primary and secondary accents (for example `#f59e0b` primary and `#fbbf24` secondary). Typography includes an “epic” display font (Cinzel) for the title and About dialog header.

## Animations and Effects

The UI includes subtle motion and feedback:

- Button hover/press effects on board squares.
- A “pop” animation when a mark is placed.
- Winning squares animate with a pulse and glow.
- Confetti fires on round win, and a larger celebration fires on series win.

## Sounds (with Toggle)

Sound effects are implemented for:

- Valid human move “click”
- Win sound
- Draw sound

A Sound On/Off toggle is persisted. Audio elements are created lazily and “unlocked” after the first user interaction (pointer down or keydown) to comply with browser autoplay policies. Sound playback is guarded so draw/win effects do not repeatedly fire for the same outcome transition.

## Localization (English/Spanish)

The app uses `i18next` + `react-i18next` and provides English and Spanish translations. Behavior includes:

- A language selector in the UI (EN/ES).
- Initial language selection from `localStorage` (`ttt-lang`) or from browser language (Spanish if navigator language starts with `es`).
- The `<html lang="...">` attribute is kept in sync on language changes for accessibility.

## Accessibility Considerations

The UI includes accessibility support primarily through ARIA labeling and keyboard usability:

- The main content uses `role="main"`.
- The board uses `role="grid"` with `aria-rowcount` / `aria-colcount`.
- Each cell is a `<button>` with a stable aria-label (`cell N`) and proper disabled states.
- Status and score areas use `aria-live="polite"` so updates are announced without being disruptive.
- Focus-visible styles are implemented for interactive elements.
- The About dialog is an accessible modal with `role="dialog"`, `aria-modal="true"`, labeled/ described-by IDs, Escape-to-close, backdrop click handling, focus trap, and focus restoration.

## About Dialog and Footer

An About button opens an About dialog that includes:

- App name (from UI constant)
- Version (read from `package.json` when available)
- Description and credits text (localized)

A simple footer is displayed under the main panel with the text `@danielm`.

## Responsive Layout (including button overflow fix)

The layout is designed for smaller screens:

- Control groups (mode/difficulty/size selectors and app settings like sound/theme/language/about) are allowed to wrap rather than overflow.
- Breakpoints adjust control group layout, allow selectors/buttons to expand, and prevent small-screen overflow.
- The board remains responsive by sizing squares via `aspect-ratio` and using `clamp()` font sizes.

## Environment Variables

The current frontend implementation does not reference `process.env.REACT_APP_*` variables in code. The container environment includes typical React variables such as `REACT_APP_API_BASE`, `REACT_APP_BACKEND_URL`, and related fields, but they are not currently used by the app.

## Tests: Status and Known Caveats

A test suite exists in `src/App.test.js` covering:

- Initial render (3×3 board, status)
- Turn alternation and status updates
- Win detection
- Draw detection
- Restart behavior

Known caveats from recent runs include failures related to:

- **i18n initialization in tests:** tests may require importing `./i18n` in the Jest setup file so translations and ARIA labels are initialized consistently.
- **Audio stubbing in JSDOM:** `HTMLMediaElement.play()` / `pause()` may need to be stubbed/mocked in the test environment because JSDOM does not fully implement media playback.

`src/setupTests.js` currently imports only `@testing-library/jest-dom`, so it is a good candidate to centralize these test setup fixes.

## Suggestions for Next Steps

If you want to continue improving the app, the following are high-impact next steps:

- Stabilize the test suite by initializing i18n in `setupTests.js` and stubbing media methods, then run tests in CI mode.
- Consider adding per-board-size scoring (optional) if you want scores to be meaningful across different grid sizes.
- Expand AI for 4×4/5×5 beyond Medium heuristics (for example, depth-limited search) while keeping performance acceptable.
- Add optional accessibility enhancements such as explicit row/column indexing for grid navigation and more descriptive cell labels (for example, “row 2 column 1”).

## Getting Started

In the project directory, you can run:

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).
