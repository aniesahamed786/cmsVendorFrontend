import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Popover } from 'primeng/popover';
import { PrimeUIModules } from '../../../core/prime.import';
import { ThemeService } from '../../../shared/services/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, FormsModule, PrimeUIModules],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  @ViewChild('profileMenu') profileMenu!: Popover;

  headerData = input<string>('');
  private readonly routeHeader = signal('Dashboard');

  readonly userName = signal('Alex Rivera');
  readonly userRole = signal('Vendor');

  readonly resolvedHeader = computed(
    () => this.headerData().trim() || this.routeHeader(),
  );

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
    this.routeHeader.set(this.formatRouteToHeader(this.router.url));
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.routeHeader.set(this.formatRouteToHeader(event.urlAfterRedirects));
      });
  }

  private formatRouteToHeader(url: string): string {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    if (!segments.length) {
      return 'Dashboard';
    }

    return segments[0]
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
    // Placeholder until vendor auth is wired.
    this.router.navigate(['/dashboard']);
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  onThemeToggle(value: boolean): void {
    this.themeService.setAppearanceMode(value ? 'dark' : 'light');
  }
}
