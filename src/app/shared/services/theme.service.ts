import { Injectable, computed, signal } from '@angular/core';
import { updatePrimaryPalette } from '@primeuix/themes';
import {
  ACCENT_THEMES,
  AccentTheme,
  DEFAULT_ACCENT_THEME,
  getAccentTheme,
} from '../theme/accent-themes';

export type AppearanceMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly modeKey = 'admin-web-theme';
  private readonly accentKey = 'admin-web-accent-theme';

  readonly appearanceModes: { value: AppearanceMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  readonly accentThemes = ACCENT_THEMES;

  private readonly osQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly prefersDark = signal(this.osQuery?.matches ?? false);

  readonly appearanceMode = signal<AppearanceMode>('light');
  readonly accentTheme = signal<AccentTheme>(DEFAULT_ACCENT_THEME);
  /** 'system' is not a look — it resolves to the OS preference. */
  readonly isDarkMode = computed(
    () =>
      this.appearanceMode() === 'dark' ||
      (this.appearanceMode() === 'system' && this.prefersDark()),
  );

  constructor() {
    this.initializeTheme();
    this.osQuery?.addEventListener('change', (e) => {
      this.prefersDark.set(e.matches);
      if (this.appearanceMode() === 'system') {
        this.apply();
      }
    });
  }

  setAppearanceMode(mode: AppearanceMode): void {
    this.appearanceMode.set(mode);
    this.apply(); // brand ramp differs per mode
    localStorage.setItem(this.modeKey, mode);
  }

  setAccentTheme(name: string): void {
    this.accentTheme.set(getAccentTheme(name));
    this.apply();
    localStorage.setItem(this.accentKey, this.accentTheme().name);
  }

  private initializeTheme(): void {
    const savedMode = localStorage.getItem(this.modeKey) as AppearanceMode | null;
    this.appearanceMode.set(savedMode ?? 'system');
    this.accentTheme.set(getAccentTheme(localStorage.getItem(this.accentKey)));
    this.apply();
  }

  /** Single write path: both axes land on the DOM together, from the resolved dark flag. */
  private apply(): void {
    document.documentElement.classList.toggle('dark-mode', this.isDarkMode());
    this.applyAccentTheme(this.accentTheme(), this.isDarkMode());
  }

  private applyAccentTheme(theme: AccentTheme, dark: boolean): void {
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
    set('--app-primary-gradient', gradient);

    // derived alpha tokens track the active accent
    set('--app-primary-soft', `rgba(${rgb}, 0.08)`);
    set('--app-primary-subtle', `rgba(${rgb}, 0.16)`);
    set('--app-primary-hover-soft', `rgba(${rgb}, 0.24)`);
    set('--app-primary-ring', `rgba(${rgb}, 0.40)`);
  }
}
