// ponytail: data-only catalog. Not yet wired into theme.service.ts/styles.scss
// (those don't exist in this repo). Light blue ramp mirrors BluePreset in app.config.ts.

export interface AccentSurfaces {
  appBg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface AccentPalette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface AccentTheme {
  name: string;
  label: string;
  swatch: string;
  background: AccentSurfaces;
  palette: AccentPalette;
  rgb: string;
  gradient: string;
  darkSwatch: string;
  darkBackground: AccentSurfaces;
  darkPalette: AccentPalette;
  darkRgb: string;
  darkGradient: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    name: 'blue',
    label: 'Blue',
    swatch: '#0033A0',
    background: {
      appBg: '#F5F7FB',
      surface: '#FFFFFF',
      text: '#1B1F2A',
      muted: '#64748B',
      border: '#E2E8F0',
    },
    palette: {
      50: '#EEF4FF',
      100: '#D9E5FF',
      200: '#BCD1FF',
      300: '#8FB1FF',
      400: '#5C87F6',
      500: '#406ED1',
      600: '#0033A0',
      700: '#002C8A',
      800: '#00246F',
      900: '#001C54',
      950: '#001238',
    },
    rgb: '0, 51, 160',
    gradient: 'linear-gradient(91.48deg, #0033A0 10%, #5C87F6 90%)',
    darkSwatch: '#2F6BFF',
    darkBackground: {
      appBg: '#1B1F2A',
      surface: '#111827',
      text: '#E5E7EB',
      muted: '#94A3B8',
      border: '#334155',
    },
    darkPalette: {
      50: '#EEF4FF',
      100: '#DCE8FF',
      200: '#BDD1FF',
      300: '#93B3FF',
      400: '#6391FF',
      500: '#4477FF',
      600: '#2F6BFF',
      700: '#2458E6',
      800: '#1C47BA',
      900: '#15368F',
      950: '#0D225F',
    },
    darkRgb: '47, 107, 255',
    darkGradient: 'linear-gradient(91.48deg, #2F6BFF 10%, #7EA6FF 90%)',
  },
];

export const DEFAULT_ACCENT_THEME = ACCENT_THEMES[0];

export function getAccentTheme(name: string | null | undefined): AccentTheme {
  return ACCENT_THEMES.find((t) => t.name === name) ?? DEFAULT_ACCENT_THEME;
}
