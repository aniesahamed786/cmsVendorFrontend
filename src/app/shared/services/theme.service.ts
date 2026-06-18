import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'vendor-web-theme';
  readonly isDarkMode = signal(false);

  constructor() {
    this.initializeTheme();
  }

  toggleDarkMode(enabled: boolean): void {
    this.isDarkMode.set(enabled);
    this.applyTheme(enabled);
    localStorage.setItem(this.storageKey, enabled ? 'dark' : 'light');
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.storageKey);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme ? savedTheme === 'dark' : !!prefersDark;
    this.isDarkMode.set(shouldUseDark);
    this.applyTheme(shouldUseDark);
  }

  private applyTheme(isDark: boolean): void {
    document.documentElement.classList.toggle('dark-mode', isDark);
  }
}
