import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';

interface RecentActivityItem {
  icon: string;
  iconClass: string;
  title: string;
  description: string;
  time: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, OfferTile, VendorQuickActions],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  vendorName = signal('Lumee Street');
  vendorDescription = signal(
    'Lumee Street is a modern casual dining brand offering fresh, flavorful meals in a vibrant and welcoming atmosphere.',
  );

  recentActivities = signal<RecentActivityItem[]>([
    {
      icon: 'pi pi-tag',
      iconClass: 'dashboard-page__activity-icon--brand',
      title: 'New offer activated',
      description: 'Summer Sale 2025',
      time: '2 mins ago',
    },
    {
      icon: 'pi pi-hourglass',
      iconClass: 'dashboard-page__activity-icon--warning',
      title: 'Offer pending approval',
      description: 'Family Package',
      time: '1 hour ago',
    },
    {
      icon: 'pi pi-user-edit',
      iconClass: 'dashboard-page__activity-icon--neutral',
      title: 'Profile update submitted',
      description: 'Profile & media',
      time: '3 hours ago',
    },
    {
      icon: 'pi pi-check-circle',
      iconClass: 'dashboard-page__activity-icon--success',
      title: 'Branch hours updated',
      description: 'Dammam Branch',
      time: 'Yesterday',
    },
    {
      icon: 'pi pi-comments',
      iconClass: 'dashboard-page__activity-icon--brand',
      title: 'Support ticket replied',
      description: 'Offer visibility issue',
      time: '2 days ago',
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
