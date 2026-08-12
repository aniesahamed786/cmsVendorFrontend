import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Popover } from 'primeng/popover';
import { PrimeUIModules } from '../../../core/prime.import';
import { ThemeService } from '../../../shared/services/theme.service';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

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

  readonly isArabic = this.i18n.isRtl;

  @ViewChild('profileMenu') profileMenu!: Popover;

  /** A translation key (`nav.<slug>.title`), emitted by Sidenav — not text. */
  headerData = input<string>('');
  private readonly routeSlug = signal('dashboard');

  readonly userName = signal('Alex Rivera');
  // ponytail: a key while the user is mocked. Real auth returns a role string —
  // pipe it through a `roles.*` lookup then, or drop the pipe in the template.
  readonly userRole = signal('navbar.roleVendor');

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
    // ponytail: no session to clear yet — add token/state cleanup when vendor auth lands.
    this.router.navigate(['/login']);
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  onThemeToggle(value: boolean): void {
    this.themeService.setAppearanceMode(value ? 'dark' : 'light');
  }

  onLanguageToggle(): void {
    this.closeProfileMenu();
    void this.i18n.toggle();
  }
}
