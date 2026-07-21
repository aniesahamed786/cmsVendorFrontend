import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PrimeUIModules } from '../../../core/prime.import';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-sidenav',
  imports: [RouterModule, CommonModule, PrimeUIModules, TranslatePipe],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.css',
})
export class Sidenav {
  // The key slug is the route segment, so Navbar can rebuild `nav.<slug>.title`
  // from the URL alone on a hard reload — no route-to-key mapping table.
  private readonly allNavItems = signal([
    { icon: 'assets/svg/Navbar/ic-dashboard.svg', labelKey: 'nav.dashboard.label', titleKey: 'nav.dashboard.title', navLink: '/dashboard' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', labelKey: 'nav.profile.label', titleKey: 'nav.profile.title', navLink: '/profile' },
    { icon: 'assets/svg/Navbar/ic-requests.svg', labelKey: 'nav.request-center.label', titleKey: 'nav.request-center.title', navLink: '/request-center' },
    { icon: 'assets/svg/Navbar/ic-offer.svg', labelKey: 'nav.offers.label', titleKey: 'nav.offers.title', navLink: '/offers' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', labelKey: 'nav.branches.label', titleKey: 'nav.branches.title', navLink: '/branches' },
    { icon: 'assets/svg/Navbar/ic-offer.svg', labelKey: 'nav.redemption.label', titleKey: 'nav.redemption.title', navLink: '/redemption' },
    { icon: 'assets/svg/Navbar/ic-msgcenter.svg', labelKey: 'nav.messaging-center.label', titleKey: 'nav.messaging-center.title', navLink: '/messaging-center' },
    { icon: 'assets/svg/Navbar/ic-analytics.svg', labelKey: 'nav.analytics.label', titleKey: 'nav.analytics.title', navLink: '/analytics' },
    { icon: 'assets/svg/Navbar/ic-log.svg', labelKey: 'nav.recent-activities.label', titleKey: 'nav.recent-activities.title', navLink: '/recent-activities' },
  ]);

  readonly navItems = this.allNavItems;
  @Output() sendNavBarHeader = new EventEmitter<string>();

  constructor(private router: Router) {}

  /** Emits the header *key*, not text, so the header re-translates on switch. */
  navigate(item: { navLink?: string; titleKey: string }): void {
    if (item?.navLink) {
      this.router.navigateByUrl(item.navLink);
    }
    this.sendNavBarHeader.emit(item.titleKey);
  }
}
