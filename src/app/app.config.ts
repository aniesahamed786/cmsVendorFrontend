import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { ActivatedRouteSnapshot, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { I18nService } from './shared/i18n/i18n.service';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { MessageService } from 'primeng/api';
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

/** The matched URL path of a route tree, without query string or fragment. */
function pathOf(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (let r: ActivatedRouteSnapshot | null = root; r; r = r.firstChild) {
    segments.push(...r.url.map((s) => s.path));
  }
  return segments.join('/');
}

const isLogin = (root: ActivatedRouteSnapshot) => root.firstChild?.routeConfig?.path === 'login';

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
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
    provideRouter(
      appRoutes,
      withViewTransitions({
        onViewTransitionCreated: ({ transition, from, to }) => {
          // Same page, different query string (search, filters, paging) — not a page change.
          if (pathOf(from) === pathOf(to)) {
            transition.skipTransition();
            return;
          }
          // In or out of sign-in the whole screen changes, so the whole screen animates;
          // inside the app only the page area does (see the view-transition rules in styles.scss).
          if (isLogin(from) || isLogin(to)) {
            const root = document.documentElement;
            root.classList.add('vt-full-page');
            void transition.finished.finally(() => root.classList.remove('vt-full-page'));
          }
        },
      }),
    ),
  ],
};
