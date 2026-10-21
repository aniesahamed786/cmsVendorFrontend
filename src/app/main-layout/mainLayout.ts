import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { PrimeUIModules } from '../core/prime.import';
import { I18nService } from '../shared/i18n/i18n.service';
import { TranslatePipe } from '../shared/i18n/translate.pipe';
import { Navbar } from './Components/navbar/navbar';
import { Sidenav } from './Components/sidenav/sidenav';
import { AuthService } from '../core/services/auth.service';
import { Button } from '../shared/Components/button/button';

/** Reachable while onboarding: fill in the profile, track its request, account settings. */
const ONBOARDING_OPEN_ROUTES = ['/profile/edit', '/request-center', '/settings', '/access-denied'];

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterModule,
    RouterOutlet,
    CommonModule,
    PrimeUIModules,
    AvatarModule,
    BreadcrumbModule,
    Sidenav,
    Navbar,
    TranslatePipe,
    Button,
  ],
  templateUrl: './mainLayout.html',
  styleUrl: './mainLayout.css',
  providers: [ConfirmationService],
})
export class MainLayout {
  // The one spot the CSS-only RTL rule can't cover: PrimeNG's drawer position is
  // a component input with no logical ('start'/'end') value, so it reads isRtl.
  readonly isRtl = inject(I18nService).isRtl;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * The onboarding stage while the vendor is not onboarded, on every page except the ones that
   * stage needs (allow-list, so a page added later is covered by default); else null.
   */
  readonly onboardingLock = computed(() => {
    const stage = this.auth.onboardingStage();
    if (stage === 'COMPLETED') return null;
    const path = this.url().split(/[?#]/)[0];
    return ONBOARDING_OPEN_ROUTES.some((route) => path === route || path.startsWith(route + '/')) ? null : stage;
  });
  readonly onboarding = this.auth.onboarding;
  /** Password change and the first profile form run without the sidenav. */
  readonly hideNav = this.auth.isOnboardingSetup;
  readonly ONBOARDING_ICONS: Record<string, string> = {
    COMPLETE_PROFILE: 'pi pi-pencil',
    PROFILE_UNDER_REVIEW: 'pi pi-clock',
  };

  constructor() {
    // Picks up a stage moved elsewhere (an admin approving or returning the profile) on the next page.
    effect(() => {
      this.url();
      untracked(() => this.auth.refreshOnboarding());
    });
  }

  /** A translation key emitted by Sidenav, resolved in the template. */
  receivedHeaderData = signal('');
  mobileSidebarOpen = signal(false);

  handledata(value: string): void {
    this.receivedHeaderData.set(value);
  }

  openMobileSidebar(): void {
    this.mobileSidebarOpen.set(true);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  handleMobileNav(value: string): void {
    this.receivedHeaderData.set(value);
    this.mobileSidebarOpen.set(false);
  }
}
