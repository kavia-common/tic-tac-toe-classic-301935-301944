import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = 'ttt-lang';

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // ignore
  }

  // Prefer browser language when available
  const navLang =
    (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en';
  return navLang.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const resources = {
  en: {
    translation: {
      app: {
        title: 'Tic Tac Toe game',
      },
      selectors: {
        mode: 'Mode',
        difficulty: 'Difficulty',
        selectMode: 'Select mode',
        selectDifficulty: 'Select difficulty',
      },
      modes: {
        twoPlayers: '2 Players',
        vsAi: 'Vs AI',
      },
      difficulties: {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
      },
      status: {
        turn: 'Turn: {{player}}',
        xWins: 'X wins!',
        oWins: 'O wins!',
        draw: "It's a draw.",
      },
      scoreboard: {
        draws: 'Draws',
        resetScores: 'Reset Scores',
        resetScoresAria: 'Reset scores',
        xScoreAria: 'X score',
        oScoreAria: 'O score',
        drawsScoreAria: 'Draws score',
      },
      controls: {
        controlsAria: 'controls',
        gameModeAria: 'Game mode',
        appSettingsAria: 'App settings',
        scoreboardAria: 'Scoreboard',
        boardAria: 'tic tac toe board',
        restart: 'Restart',
        restartAria: 'Restart game',
        soundOn: 'Sound on',
        soundOff: 'Sound off',
        muteSounds: 'Mute sounds',
        unmuteSounds: 'Unmute sounds',
        themeDark: 'Dark',
        themeLight: 'Light',
        switchToLightTheme: 'Switch to light theme',
        switchToDarkTheme: 'Switch to dark theme',
        language: 'Language',
        selectLanguage: 'Select language',
        footerAria: 'Footer',
      },
      board: {
        cellAria: 'cell {{number}}',
      },
      languages: {
        en: 'English',
        es: 'Español',
      },
    },
  },
  es: {
    translation: {
      app: {
        title: 'Juego de Tres en Raya',
      },
      selectors: {
        mode: 'Modo',
        difficulty: 'Dificultad',
        selectMode: 'Seleccionar modo',
        selectDifficulty: 'Seleccionar dificultad',
      },
      modes: {
        twoPlayers: '2 Jugadores',
        vsAi: 'Contra IA',
      },
      difficulties: {
        easy: 'Fácil',
        medium: 'Medio',
        hard: 'Difícil',
      },
      status: {
        turn: 'Turno: {{player}}',
        xWins: '¡X gana!',
        oWins: '¡O gana!',
        draw: 'Empate.',
      },
      scoreboard: {
        draws: 'Empates',
        resetScores: 'Reiniciar marcador',
        resetScoresAria: 'Reiniciar marcador',
        xScoreAria: 'Puntuación de X',
        oScoreAria: 'Puntuación de O',
        drawsScoreAria: 'Puntuación de empates',
      },
      controls: {
        controlsAria: 'controles',
        gameModeAria: 'Modo de juego',
        appSettingsAria: 'Ajustes de la app',
        scoreboardAria: 'Marcador',
        boardAria: 'tablero de tres en raya',
        restart: 'Reiniciar',
        restartAria: 'Reiniciar juego',
        soundOn: 'Sonido activado',
        soundOff: 'Sonido desactivado',
        muteSounds: 'Silenciar sonidos',
        unmuteSounds: 'Activar sonidos',
        themeDark: 'Oscuro',
        themeLight: 'Claro',
        switchToLightTheme: 'Cambiar a tema claro',
        switchToDarkTheme: 'Cambiar a tema oscuro',
        language: 'Idioma',
        selectLanguage: 'Seleccionar idioma',
        footerAria: 'Pie de página',
      },
      board: {
        cellAria: 'celda {{number}}',
      },
      languages: {
        en: 'English',
        es: 'Español',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
  react: {
    useSuspense: false,
  },
});

// Persist language and keep <html lang="..."> in sync for accessibility.
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
  try {
    document.documentElement.setAttribute('lang', lng);
  } catch {
    // ignore
  }
});

// Set initial lang attribute as well.
try {
  document.documentElement.setAttribute('lang', i18n.language || 'en');
} catch {
  // ignore
}

export default i18n;
