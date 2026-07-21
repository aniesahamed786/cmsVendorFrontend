import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';

interface RecentActivityItem {
  icon: string;
  iconClass: string;
  /** Key prefix; the template appends `.title`, `.description`, `.time`. */
  key: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, OfferTile, VendorQuickActions, TranslatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  vendorName = signal('Lumee Street');
  vendorDescription = signal(
    'Lumee Street is a modern casual dining brand offering fresh, flavorful meals in a vibrant and welcoming atmosphere.',
  );

  // ponytail: fixtures, so the whole row is translated copy — including the
  // descriptions and the "2 mins ago" times, which is the only way the Arabic
  // dashboard reads as Arabic today. When the real feed lands, descriptions
  // become server data and times want Intl.RelativeTimeFormat(i18n.locale()).
  recentActivities = signal<RecentActivityItem[]>([
    {
      icon: 'pi pi-tag',
      iconClass: 'dashboard-page__activity-icon--brand',
      key: 'dashboard.activity.offerActivated',
    },
    {
      icon: 'pi pi-hourglass',
      iconClass: 'dashboard-page__activity-icon--warning',
      key: 'dashboard.activity.offerPending',
    },
    {
      icon: 'pi pi-user-edit',
      iconClass: 'dashboard-page__activity-icon--neutral',
      key: 'dashboard.activity.profileSubmitted',
    },
    {
      icon: 'pi pi-check-circle',
      iconClass: 'dashboard-page__activity-icon--success',
      key: 'dashboard.activity.branchHours',
    },
    {
      icon: 'pi pi-comments',
      iconClass: 'dashboard-page__activity-icon--brand',
      key: 'dashboard.activity.ticketReplied',
    },
  ]);

  constructor(private readonly router: Router) {}

  goToOffers(): void {
    this.router.navigate(['/offers']);
  }

  goToRequestCenter(): void {
    this.router.navigate(['/request-center']);
  }

  goToRecentActivities(): void {
    this.router.navigate(['/recent-activities']);
  }

  goToCreateOffer(): void {
    this.router.navigate(['/offers/create']);
  }

  goToEditProfile(): void {
    this.router.navigate(['/profile/edit']);
  }

  goToContactSupport(): void {
    this.router.navigate(['/messaging-center']);
  }
}
