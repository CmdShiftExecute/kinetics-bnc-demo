import { useEffect, useState } from 'react';
import { IconMenu } from './IconMenu';

type Theme = 'parchment' | 'light' | 'dark';
const STORAGE_KEY = 'pis-theme';
const validTheme = (value: string | null | undefined): Theme => value === 'light' || value === 'dark' ? value : 'parchment';

/** The early head script restores the theme before paint; storage is optional. */
export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(() => validTheme(document.documentElement.dataset.theme));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Private browsing can deny storage. */ }
  }, [theme]);
  return (
    <IconMenu label="Theme" icon={<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" /></svg>}>
      {(['parchment', 'light', 'dark'] as const).map(value => (
        <button key={value} type="button" role="menuitemradio" tabIndex={-1} aria-checked={theme === value} onClick={() => setTheme(value)}>
          <span className={'theme-swatch theme-swatch-' + value} aria-hidden="true" />
          <span>{value === 'parchment' ? 'Parchment' : value === 'light' ? 'Light' : 'Dark'}</span>
          {theme === value && <span className="menu-check" aria-hidden="true">✓</span>}
        </button>
      ))}
    </IconMenu>
  );
}
