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
import { timeAgo } from '../../../shared/utils/time-ago';
import {
  NotificationCenterService,
  VendorNotification,
} from '../../../shared/services/notification-center.service';

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
  private readonly notificationCenter = inject(NotificationCenterService);

  readonly isArabic = this.i18n.isRtl;

  readonly notifications = this.notificationCenter.notifications;
  readonly messages = this.notificationCenter.messages;
  readonly notificationsLoading = this.notificationCenter.loading;

  /**
   * The bell is a second way into a page. A Messages row opens Messaging Center, so an account
   * without that permission is shown neither the section nor its unread count — a badge for
   * something you can't open is just a dead end.
   */
  private readonly canViewMessaging = computed(() => this.authService.canView('messaging_center'));

  readonly notificationSections = computed(() => [
    ...(this.canViewMessaging()
      ? [{ key: 'notifications.messages', icon: 'pi-comments', rows: this.messages() }]
      : []),
    { key: 'notifications.title', icon: 'pi-bell', rows: this.notifications() },
  ]);

  readonly unreadCount = computed(() =>
    this.notificationSections().reduce(
      (total, section) => total + section.rows.filter((row) => !row.isRead).length,
      0,
    ),
  );

  readonly hasNotificationItem = computed(() =>
    this.notificationSections().some((section) => section.rows.length > 0),
  );

  @ViewChild('profileMenu') profileMenu!: Popover;
  @ViewChild('notificationMenu') notificationMenu!: Popover;

  /** A translation key (`nav.<slug>.title`), emitted by Sidenav — not text. */
  headerData = input<string>('');
  private readonly routeSlug = signal('dashboard');

  readonly userName = computed(() => this.authService.displayName() || 'Alex Rivera');
  /** The last always-visible link to a permission-gated page — hide it like a menu item. */
  readonly canViewProfile = computed(() => this.authService.canView('profile'));
  /** Already translated + humanized by the auth service — no pipe in the template. */
  readonly userRole = computed(() => this.authService.displayRole() || this.i18n.t('navbar.roleVendor'));
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
    // Root-scoped service, but the navbar is rebuilt per login — refresh here so a
    // re-login as another vendor never shows the previous one's badge.
    this.notificationCenter.load();
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

  // --- Notification bell -----------------------------------------------------

  onNotificationsShow(): void {
    this.notificationCenter.load();
  }

  markAllNotificationsRead(): void {
    this.notificationCenter.markAllAsRead();
  }

  onNotificationClick(notification: VendorNotification): void {
    this.notificationMenu?.hide();
    this.notificationCenter.open(notification);
  }

  notificationIcon(notification: VendorNotification): string {
    if (notification.type === 'MESSAGE') return 'pi-comments';
    return notification.type === 'SYSTEM' ? 'pi-cog' : 'pi-bell';
  }

  notificationTitle(notification: VendorNotification): string {
    return this.isArabic() && notification.titleAr ? notification.titleAr : notification.title;
  }

  notificationDescription(notification: VendorNotification): string {
    return this.isArabic() && notification.descriptionAr
      ? notification.descriptionAr
      : notification.description;
  }

  timeAgo(iso: string): string {
    return timeAgo(iso, this.isArabic());
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
