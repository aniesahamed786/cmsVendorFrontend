import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AppLang = 'en' | 'ar';

const STORAGE_KEY = 'cmsVendorLang';

function flattenTranslations(obj: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenTranslations(v as object, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);

  /** Bumps after each successful JSON load so the impure pipe re-runs. */
  readonly loadSeq = signal(0);

  readonly lang = signal<AppLang>('en');

  private readonly dict = signal<Record<string, string>>({});

  /** For the date/number pipes: `| date : 'short' : undefined : i18n.locale()`. */
  readonly locale = computed(() => (this.lang() === 'ar' ? 'ar-SA' : 'en-US'));

  /** Keep numeric data in Western digits in both interface languages. */
  readonly numberLocale = 'en-US';

  readonly isRtl = computed(() => this.lang() === 'ar');

  /** Called by provideAppInitializer so no page paints raw keys. */
  async init(): Promise<void> {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') {
      this.lang.set(saved);
    }
    this.applyLang();
    await this.loadTranslations(this.lang());
  }

  async setLang(lang: AppLang): Promise<void> {
    if (this.lang() === lang) return;
    this.lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    this.applyLang();
    await this.loadTranslations(lang);
  }

  toggle(): Promise<void> {
    return this.setLang(this.lang() === 'ar' ? 'en' : 'ar');
  }

  t(key: string, params?: Record<string, string | number>): string {
    let s = this.dict()[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split(`{{${k}}}`).join(String(v));
      }
    }
    return s;
  }

  /** Only `lang`. Direction comes from `html[lang="ar"]` in styles.scss. */
  private applyLang(): void {
    document.documentElement.lang = this.lang();
  }

  private async loadTranslations(lang: AppLang): Promise<void> {
    this.dict.set(await this.fetch(lang).catch(() => this.fetchFallback(lang)));
    this.loadSeq.update((n) => n + 1);
  }

  private fetch(lang: AppLang): Promise<Record<string, string>> {
    return firstValueFrom(
      this.http.get<Record<string, unknown>>(`assets/i18n/${lang}.json`),
    ).then(flattenTranslations);
  }

  private fetchFallback(lang: AppLang): Promise<Record<string, string>> {
    // ponytail: a missing ar.json falls back to English rather than rendering
    // raw keys. A missing en.json is a build problem — render keys, they debug it.
    return lang === 'en' ? Promise.resolve({}) : this.fetch('en').catch(() => ({}));
  }
}
