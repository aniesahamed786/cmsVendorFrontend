import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PrimeUIModules } from '../../../core/prime.import';

@Component({
  selector: 'app-sidenav',
  imports: [RouterModule, CommonModule, PrimeUIModules],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.css',
})
export class Sidenav {
  private readonly allNavItems = signal([
    { icon: 'assets/svg/Navbar/ic-dashboard.svg', navItem: 'Dashboard', title: 'Dashboard', navLink: '/dashboard' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', navItem: 'Profile', title: 'Vendor Profile', navLink: '/profile' },
    { icon: 'assets/svg/Navbar/ic-offer.svg', navItem: 'Offers', title: 'Offers', navLink: '/offers' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', navItem: 'Stores', title: 'Stores', navLink: '/stores' },
    { icon: 'assets/svg/Navbar/ic-msgcenter.svg', navItem: 'Messaging Center', title: 'Messaging Center', navLink: '/messaging-center' },
    { icon: 'assets/svg/Navbar/ic-requests.svg', navItem: 'Request Center', title: 'Request Center', navLink: '/request-center' },
    { icon: 'assets/svg/Navbar/ic-log.svg', navItem: 'Recent Activities', title: 'Recent Activities', navLink: '/recent-activities' },
    { icon: 'assets/svg/Navbar/ic-analytics.svg', navItem: 'Analytics', title: 'Analytics', navLink: '/analytics' },
  ]);

  readonly navItems = this.allNavItems;
  @Output() sendNavBarHeader = new EventEmitter<string>();

  constructor(private router: Router) {}

  navigate(item: { navLink?: string; title: string }): void {
    if (item?.navLink) {
      this.router.navigateByUrl(item.navLink);
    }
    this.sendNavBarHeader.emit(item.title);
  }
}
