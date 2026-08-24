import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { I18nService } from './shared/i18n/i18n.service';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { appRoutes } from './app.routes';
import { httpInterceptor } from './shared/interceptor/http-interceptor';

const BluePreset = definePreset(Aura, {
  semantic: {
    primary: {
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
  },
  components: {
    button: {
      root: {
        borderRadius: '0',
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([httpInterceptor])),
    // Blocks bootstrap until the dictionary is in, so no page paints raw keys.
    provideAppInitializer(() => inject(I18nService).init()),
    providePrimeNG({
      ripple: true,
      zIndex: {
        modal: 2100,
        overlay: 2200,
        menu: 2200,
        tooltip: 2300,
      },
      theme: {
        preset: BluePreset,
        options: {
          prefix: 'prime',
          darkModeSelector: '.dark-mode',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
      },
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
  ],
};
