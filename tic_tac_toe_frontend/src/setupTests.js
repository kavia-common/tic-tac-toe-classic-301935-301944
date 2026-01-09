/**
 * Global Jest setup for React Testing Library tests.
 *
 * Notes:
 * - We initialize i18n here so components using `useTranslation()` render translated
 *   strings instead of raw i18n keys in tests.
 * - We stub media methods because JSDOM does not implement real audio/video playback.
 */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

import './i18n';

// Stub missing media playback APIs in JSDOM (used by the app's sound effects)
HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue();
HTMLMediaElement.prototype.pause = jest.fn();
