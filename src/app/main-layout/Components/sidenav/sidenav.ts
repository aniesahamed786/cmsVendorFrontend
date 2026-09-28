import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PrimeUIModules } from '../../../core/prime.import';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { AuthService, PermissionResource } from '../../../core/services/auth.service';

interface NavItem {
  icon: string;
  labelKey: string;
  titleKey: string;
  navLink: string;
  /** The `cms_<resource>` this page needs, without the prefix or level. */
  permissionKey?: PermissionResource;
  /** Pages without a token permission that belong only to the main vendor account. */
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidenav',
  imports: [RouterModule, CommonModule, PrimeUIModules, TranslatePipe],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.css',
})
export class Sidenav {
  // The key slug is the route segment, so Navbar can rebuild `nav.<slug>.title`
  // from the URL alone on a hard reload — no route-to-key mapping table.
  private readonly allNavItems = signal<NavItem[]>([
    { icon: 'assets/svg/Navbar/ic-dashboard.svg', labelKey: 'nav.dashboard.label', titleKey: 'nav.dashboard.title', navLink: '/dashboard' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', labelKey: 'nav.profile.label', titleKey: 'nav.profile.title', navLink: '/profile', permissionKey: 'profile' },
    { icon: 'assets/svg/Navbar/ic-requests.svg', labelKey: 'nav.request-center.label', titleKey: 'nav.request-center.title', navLink: '/request-center', adminOnly: true },
    { icon: 'assets/svg/Navbar/ic-offer.svg', labelKey: 'nav.offers.label', titleKey: 'nav.offers.title', navLink: '/offers', permissionKey: 'offers' },
    { icon: 'pi pi-shop', labelKey: 'nav.branches.label', titleKey: 'nav.branches.title', navLink: '/branches', permissionKey: 'locations' },
    { icon: 'assets/svg/Navbar/ic-offer.svg', labelKey: 'nav.redemption.label', titleKey: 'nav.redemption.title', navLink: '/redemption', permissionKey: 'redemptions' },
    { icon: 'assets/svg/Navbar/ic-vendor.svg', labelKey: 'nav.account-management.label', titleKey: 'nav.account-management.title', navLink: '/account-management', permissionKey: 'vendor_staff' },
    { icon: 'assets/svg/Navbar/ic-msgcenter.svg', labelKey: 'nav.messaging-center.label', titleKey: 'nav.messaging-center.title', navLink: '/messaging-center', permissionKey: 'messaging_center' },
    { icon: 'assets/svg/Navbar/ic-analytics.svg', labelKey: 'nav.analytics.label', titleKey: 'nav.analytics.title', navLink: '/analytics', permissionKey: 'analytics' },
    { icon: 'assets/svg/Navbar/ic-log.svg', labelKey: 'nav.recent-activities.label', titleKey: 'nav.recent-activities.title', navLink: '/recent-activities' },
  ]);

  private readonly auth = inject(AuthService);

  /**
   * Never paint a link the user can't open. Request Center has no token permission and is
   * vendor-admin-only. Other items without a permission key remain visible for both roles.
   */
  readonly navItems = computed(() =>
    this.allNavItems().filter(
      (item) =>
        (!item.adminOnly || this.auth.canViewRequestCenter()) &&
        (!item.permissionKey || this.auth.canView(item.permissionKey)),
    ),
  );
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
