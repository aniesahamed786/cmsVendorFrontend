import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { PrimeUIModules } from '../core/prime.import';
import { I18nService } from '../shared/i18n/i18n.service';
import { TranslatePipe } from '../shared/i18n/translate.pipe';
import { Navbar } from './Components/navbar/navbar';
import { Sidenav } from './Components/sidenav/sidenav';

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
  ],
  templateUrl: './mainLayout.html',
  styleUrl: './mainLayout.css',
  providers: [ConfirmationService, MessageService],
})
export class MainLayout {
  // The one spot the CSS-only RTL rule can't cover: PrimeNG's drawer position is
  // a component input with no logical ('start'/'end') value, so it reads isRtl.
  readonly isRtl = inject(I18nService).isRtl;

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
