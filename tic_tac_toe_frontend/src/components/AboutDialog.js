import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * An accessible modal dialog with:
 * - focus trap (Tab/Shift+Tab loops within dialog)
 * - aria-modal + role="dialog"
 * - Esc to close
 * - click on backdrop to close
 * - restores focus to the trigger element on close
 */

// PUBLIC_INTERFACE
export default function AboutDialog({ open, onClose, appName, version }) {
  /** Public About dialog modal. */
  const { t } = useTranslation();

  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const previouslyFocusedElRef = useRef(null);

  const titleId = useMemo(
    () => `about-dialog-title-${Math.random().toString(36).slice(2)}`,
    []
  );
  const descId = useMemo(
    () => `about-dialog-desc-${Math.random().toString(36).slice(2)}`,
    []
  );

  // Store currently focused element before opening; restore on close/unmount.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedElRef.current =
      (typeof document !== 'undefined' && document.activeElement) || null;

    // Focus the close button first (predictable keyboard behavior).
    const tmr = window.setTimeout(() => {
      closeBtnRef.current?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(tmr);
      const prev = previouslyFocusedElRef.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
      previouslyFocusedElRef.current = null;
    };
  }, [open]);

  // Close on Escape + trap focus within dialog.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;

      // Focus trap: collect focusable elements inside dialog.
      const focusables = root.querySelectorAll(
        [
          'a[href]',
          'button:not([disabled])',
          'textarea:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',')
      );

      const list = Array.from(focusables).filter(
        (el) => el && typeof el.focus === 'function' && el.offsetParent !== null
      );

      if (list.length === 0) return;

      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayMouseDown = (e) => {
    // Only close if the click is on the backdrop itself (not inside the dialog).
    if (e.target === overlayRef.current) {
      onClose?.();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="about-overlay"
      onMouseDown={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="about-header">
          <div className="about-title-wrap">
            <h2 className="about-title" id={titleId}>
              {t('about.title', { appName })}
            </h2>
            <div className="about-meta" aria-label={t('about.versionAria')}>
              {version ? t('about.version', { version }) : t('about.versionUnknown')}
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="about-close"
            onClick={onClose}
            aria-label={t('about.closeAria')}
            title={t('about.closeAria')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="about-body" id={descId}>
          <p className="about-description">{t('about.description')}</p>

          <div className="about-credits">
            <div className="about-credits-label">{t('about.creditsLabel')}</div>
            <div className="about-credits-text">{t('about.creditsText')}</div>
          </div>

          <div className="about-actions">
            <button type="button" className="series-btn" onClick={onClose}>
              {t('about.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
