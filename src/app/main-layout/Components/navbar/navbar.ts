import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Popover } from 'primeng/popover';
import { PrimeUIModules } from '../../../core/prime.import';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import {
  ProfileSettingsService,
  UpdateProfileSettingsPayload,
} from '../../../features/Profile-settings/services/profile-settings.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error-message';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, FormsModule, PrimeUIModules, TranslatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly i18n = inject(I18nService);
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(ProfileSettingsService);
  private readonly messageService = inject(MessageService);

  readonly isArabic = this.i18n.isRtl;

  @ViewChild('profileMenu') profileMenu!: Popover;

  /** A translation key (`nav.<slug>.title`), emitted by Sidenav — not text. */
  headerData = input<string>('');
  private readonly routeSlug = signal('dashboard');

  readonly userName = computed(() => this.authService.getVendorAccount()?.name || 'Alex Rivera');
  // ponytail: a key while the user is mocked. Real auth returns a role string —
  // pipe it through a `roles.*` lookup then, or drop the pipe in the template.
  readonly userRole = signal('navbar.roleVendor');
  readonly preferenceSaving = signal(false);

  readonly resolvedHeader = computed(() => {
    this.i18n.lang();
    this.i18n.loadSeq();
    const key = this.headerData().trim() || `nav.${this.routeSlug()}.title`;
    const text = this.i18n.t(key);
    // Routes with no sidenav entry (settings, create-offer) have no key, and t()
    // echoes the key back. Fall back to the prettified slug over painting it raw.
    return text === key ? this.prettify(this.routeSlug()) : text;
  });

  readonly avatarLabel = computed(() => {
    const parts = this.userName().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'V';
    }
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  constructor() {
    this.routeSlug.set(this.slugFromUrl(this.router.url));
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.routeSlug.set(this.slugFromUrl(event.urlAfterRedirects));
      });
  }

  private slugFromUrl(url: string): string {
    return url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
  }

  private prettify(slug: string): string {
    return slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  closeProfileMenu(): void {
    this.profileMenu?.hide();
  }

  onProfile(): void {
    this.closeProfileMenu();
    this.router.navigate(['/profile']);
  }

  onSettings(): void {
    this.closeProfileMenu();
    this.router.navigate(['/settings']);
  }

  onLogout(): void {
    this.closeProfileMenu();
    this.authService.logout();
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  onThemeToggle(value: boolean): void {
    if (this.preferenceSaving()) return;
    const previous = this.themeService.appearanceMode();
    const next = value ? 'dark' : 'light';
    this.themeService.setAppearanceMode(next);
    this.persistPreference(
      { theme: value ? 'DARK' : 'LIGHT' },
      () => this.themeService.setAppearanceMode(previous),
    );
  }

  onLanguageToggle(): void {
    if (this.preferenceSaving()) return;
    this.closeProfileMenu();
    const previous = this.i18n.lang();
    const next = previous === 'ar' ? 'en' : 'ar';
    void this.i18n.setLang(next);
    this.persistPreference(
      { language: next === 'ar' ? 'ARABIC' : 'ENGLISH' },
      () => void this.i18n.setLang(previous),
    );
  }

  private persistPreference(payload: UpdateProfileSettingsPayload, rollback: () => void): void {
    this.preferenceSaving.set(true);
    this.settingsService
      .updateSettings(payload)
      .pipe(finalize(() => this.preferenceSaving.set(false)))
      .subscribe({
        next: (account) =>
          this.authService.updateVendorAccountPreferences(account.language, account.theme),
        error: (err: HttpErrorResponse) => {
          rollback();
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('settingsPage.toast.saveFailedSummary'),
            detail: extractApiErrorMessage(err) ?? this.i18n.t('settingsPage.toast.saveFailedDetail'),
            life: 5000,
          });
        },
      });
  }
}
