import { Injectable, computed, signal } from '@angular/core';
import { updatePrimaryPalette } from '@primeuix/themes';
import {
  ACCENT_THEMES,
  AccentTheme,
  DEFAULT_ACCENT_THEME,
  getAccentTheme,
} from '../theme/accent-themes';

export type AppearanceMode = 'light' | 'dark' | 'national-day';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly modeKey = 'admin-web-theme';
  private readonly accentKey = 'admin-web-accent-theme';

  readonly appearanceModes: { value: AppearanceMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'national-day', label: 'National Day' },
  ];
  readonly accentThemes = ACCENT_THEMES;

  readonly appearanceMode = signal<AppearanceMode>('light');
  readonly accentTheme = signal<AccentTheme>(DEFAULT_ACCENT_THEME);
  readonly isDarkMode = computed(() => this.appearanceMode() === 'dark');

  constructor() {
    this.initializeTheme();
  }

  setAppearanceMode(mode: AppearanceMode): void {
    this.appearanceMode.set(mode);
    this.applyAppearanceMode(mode);
    this.applyAccentTheme(this.accentTheme(), mode); // brand ramp differs per mode
    localStorage.setItem(this.modeKey, mode);
  }

  setAccentTheme(name: string): void {
    const theme = getAccentTheme(name);
    this.accentTheme.set(theme);
    this.applyAccentTheme(theme, this.appearanceMode());
    localStorage.setItem(this.accentKey, theme.name);
  }

  private initializeTheme(): void {
    const savedMode = localStorage.getItem(this.modeKey) as AppearanceMode | null;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const mode: AppearanceMode = savedMode ?? (prefersDark ? 'dark' : 'light');
    const theme = getAccentTheme(localStorage.getItem(this.accentKey));

    this.appearanceMode.set(mode);
    this.accentTheme.set(theme);
    this.applyAccentTheme(theme, mode);
    this.applyAppearanceMode(mode);
  }

  private applyAppearanceMode(mode: AppearanceMode): void {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', mode === 'dark');
    root.classList.toggle('national-day-mode', mode === 'national-day');
  }

  private applyAccentTheme(theme: AccentTheme, mode: AppearanceMode): void {
    const dark = mode === 'dark';
    const palette = dark ? theme.darkPalette : theme.palette;
    const rgb = dark ? theme.darkRgb : theme.rgb;
    const gradient = dark ? theme.darkGradient : theme.gradient;

    updatePrimaryPalette(palette);

    const root = document.documentElement;
    root.dataset['accentTheme'] = theme.name;
    const set = (k: string, v: string) => root.style.setProperty(k, v);

    // surfaces — light + dark both written; the mode class chooses which resolves
    const surfaces = (prefix: string, s: AccentTheme['background']) => {
      set(`${prefix}-bg`, s.appBg);
      set(`${prefix}-surface`, s.surface);
      set(`${prefix}-text`, s.text);
      set(`${prefix}-muted`, s.muted);
      set(`${prefix}-border`, s.border);
    };
    surfaces('--app-light', theme.background);
    surfaces('--app-dark', theme.darkBackground);

    // brand ramp — uses the active mode's palette/rgb/gradient
    Object.entries(palette).forEach(([k, v]) => set(`--app-primary-${k}`, v));
    set('--app-primary', palette[600]);
    set('--app-primary-700', palette[700]);
    set('--app-primary-rgb', rgb);
    set('--app-gradient', gradient);

    // derived alpha tokens track the active accent
    set('--app-primary-soft', `rgba(${rgb}, 0.08)`);
    set('--app-primary-subtle', `rgba(${rgb}, 0.16)`);
    set('--app-primary-hover-soft', `rgba(${rgb}, 0.24)`);
    set('--app-primary-ring', `rgba(${rgb}, 0.40)`);
  }
}
