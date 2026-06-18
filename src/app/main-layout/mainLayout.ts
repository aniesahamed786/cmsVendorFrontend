import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { PrimeUIModules } from '../core/prime.import';
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
  ],
  templateUrl: './mainLayout.html',
  styleUrl: './mainLayout.css',
  providers: [ConfirmationService, MessageService],
})
export class MainLayout {
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
