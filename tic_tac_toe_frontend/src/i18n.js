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
        size: 'Size',
        selectMode: 'Select mode',
        selectDifficulty: 'Select difficulty',
        selectSize: 'Select board size',
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
      series: {
        toggleLabel: 'Series mode',
        toggleAria: 'Toggle series mode',
        panelAria: 'Series controls',
        bestOf: 'Best of',
        bestOfAria: 'Select best-of series length',
        actionsAria: 'Series actions',
        start: 'Start Series',
        startAria: 'Start series',
        nextRound: 'Next Round',
        nextRoundAria: 'Start next round',
        end: 'End Series',
        endAria: 'End series',
        notStarted: 'Series ready: Best of {{n}} (first to {{threshold}}).',
        inProgress: 'Series: Round {{round}} · X {{x}} - O {{o}} (first to {{threshold}}).',
        winner: 'Series winner: {{player}}! (X {{x}} - O {{o}})',
        scoreAria: 'Series score',
        xWinsAria: 'Series wins for X',
        oWinsAria: 'Series wins for O',
        firstTo: 'First to {{threshold}}',
        thresholdAria: 'Series win threshold: {{threshold}}',
      },
      about: {
        open: 'About',
        openAria: 'Open About dialog',
        title: 'About {{appName}}',
        description: 'A simple, modern Tic Tac Toe experience with local multiplayer and an optional AI opponent.',
        creditsLabel: 'Credits',
        creditsText: '© @danielm',
        version: 'Version {{version}}',
        versionUnknown: 'Version unavailable',
        versionAria: 'Application version',
        close: 'Close',
        closeAria: 'Close About dialog',
      },
      sizes: {
        size3: '3×3',
        size4: '4×4 (Experimental)',
        size5: '5×5 (Experimental)',
      },
      languages: {
        en: 'English',
        es: 'Español',
      },
      palette: {
        label: 'Palette',
        selectAria: 'Select color palette',
        options: {
          default: 'Default',
          deuteranopia: 'Deuteranopia-friendly',
          tritanopia: 'Tritanopia-friendly',
        },
      },
      history: {
        title: 'History',
        panelAria: 'Move history',
        subtitle: 'Viewing move {{current}} of {{total}}',
        moveStart: 'Start (move 0)',
        moveItem: 'Move {{move}}: {{player}} → cell {{cell}}',
        gotoMoveAria: 'Go to move {{move}}',
        viewingPast: 'Viewing past move: {{move}}',
        gotoLatest: 'Go to latest',
        gotoLatestAria: 'Return to latest move',
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
        size: 'Tamaño',
        selectMode: 'Seleccionar modo',
        selectDifficulty: 'Seleccionar dificultad',
        selectSize: 'Seleccionar tamaño del tablero',
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
      series: {
        toggleLabel: 'Modo serie',
        toggleAria: 'Activar modo serie',
        panelAria: 'Controles de serie',
        bestOf: 'Mejor de',
        bestOfAria: 'Seleccionar longitud de la serie',
        actionsAria: 'Acciones de la serie',
        start: 'Iniciar serie',
        startAria: 'Iniciar serie',
        nextRound: 'Siguiente ronda',
        nextRoundAria: 'Iniciar siguiente ronda',
        end: 'Terminar serie',
        endAria: 'Terminar serie',
        notStarted: 'Serie lista: Mejor de {{n}} (primero a {{threshold}}).',
        inProgress: 'Serie: Ronda {{round}} · X {{x}} - O {{o}} (primero a {{threshold}}).',
        winner: '¡Ganador de la serie: {{player}}! (X {{x}} - O {{o }})',
        scoreAria: 'Marcador de la serie',
        xWinsAria: 'Victorias en la serie de X',
        oWinsAria: 'Victorias en la serie de O',
        firstTo: 'Primero a {{threshold}}',
        thresholdAria: 'Umbral para ganar la serie: {{threshold}}',
      },
      about: {
        open: 'Acerca de',
        openAria: 'Abrir el diálogo de Acerca de',
        title: 'Acerca de {{appName}}',
        description: 'Una experiencia sencilla y moderna de Tres en Raya con multijugador local y un oponente de IA opcional.',
        creditsLabel: 'Créditos',
        creditsText: '© @danielm',
        version: 'Versión {{version}}',
        versionUnknown: 'Versión no disponible',
        versionAria: 'Versión de la aplicación',
        close: 'Cerrar',
        closeAria: 'Cerrar el diálogo de Acerca de',
      },
      board: {
        cellAria: 'celda {{number}}',
      },
      languages: {
        en: 'English',
        es: 'Español',
      },
      palette: {
        label: 'Paleta',
        selectAria: 'Seleccionar paleta de colores',
        options: {
          default: 'Predeterminada',
          deuteranopia: 'Para deuteranopía',
          tritanopia: 'Para tritanopía',
        },
      },
      history: {
        title: 'Historial',
        panelAria: 'Historial de movimientos',
        subtitle: 'Viendo movimiento {{current}} de {{total}}',
        moveStart: 'Inicio (movimiento 0)',
        moveItem: 'Movimiento {{move}}: {{player}} → celda {{cell}}',
        gotoMoveAria: 'Ir al movimiento {{move}}',
        viewingPast: 'Viendo un movimiento anterior: {{move}}',
        gotoLatest: 'Ir al último',
        gotoLatestAria: 'Volver al último movimiento',
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
