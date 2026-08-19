import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';
import { DashboardService } from '../../services/dashboard.service';
import { OnInit, inject } from '@angular/core';
import { toActivityRow } from '../../../recent-activities/models/system-log.mapper';
import { SystemLogService } from '../../../recent-activities/services/system-log.service';

interface RecentActivityItem {
  icon: string;
  iconClass: string;
  title: string;
  description: string;
  time: string;
}

const ACTIVITY_ICONS: Record<string, string> = {
  OFFER: 'pi pi-tag',
  STORE: 'pi pi-building',
  PROFILE: 'pi pi-user-edit',
  HIGHLIGHT: 'pi pi-star',
};

const ACTIVITY_ICON_CLASSES: Record<string, string> = {
  APPROVED: 'dashboard-page__activity-icon--success',
  SUBMITTED: 'dashboard-page__activity-icon--warning',
  PENDING: 'dashboard-page__activity-icon--warning',
  RETURNED: 'dashboard-page__activity-icon--neutral',
  REJECTED: 'dashboard-page__activity-icon--neutral',
  RECALLED: 'dashboard-page__activity-icon--neutral',
  CANCELLED: 'dashboard-page__activity-icon--neutral',
};

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, OfferTile, VendorQuickActions, TranslatePipe],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage implements OnInit {
  headerLoading = signal(false);
  vendorName = signal('Lumee Street');
  vendorDescription = signal(
    'Lumee Street is a modern casual dining brand offering fresh, flavorful meals in a vibrant and welcoming atmosphere.',
  );
  dashboardStats = signal({
    totalRedemptions: 0,
    activeOffers: 0,
    pendingRequests: 0,
    expiringSoonOffers: 0,
  });

  statsLoading = signal(true);
  pendingRequestsLoading = signal(true);
  readonly skeletonStats = [0, 1, 2, 3];
  readonly skeletonPendingRows = [0, 1, 2];

  // ponytail: server copy is English-only; times stay absolute like the
  // recent-activities table. Relative "2 mins ago" wants Intl.RelativeTimeFormat.
  recentActivities = signal<RecentActivityItem[]>([]);
  activityLoading = signal(true);
  readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly dashboardService = inject(DashboardService);
  private readonly systemLogs = inject(SystemLogService);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.statsLoading.set(true);
    this.pendingRequestsLoading.set(true);
    this.dashboardService
      .getDashboardStats()
      .pipe(
        finalize(() => {
          this.statsLoading.set(false);
          this.pendingRequestsLoading.set(false);
        }),
      )
      .subscribe({
        next: (stats) => {
          this.dashboardStats.set(stats);
        },
        error: (err) => {
          console.error('Failed to load dashboard stats', err);
        },
      });

  this.systemLogs.getSystemLogs({ page: 1, pageSize: 5, sortOrder: 'desc' })
    .pipe(finalize(() => this.activityLoading.set(false)))
    .subscribe({
    next: (res) =>
      this.recentActivities.set(
        (res?.data ?? []).map((entry) => {
          const row = toActivityRow(entry);
          return {
            icon: ACTIVITY_ICONS[entry.entityType] ?? 'pi pi-clock',
            iconClass:
              ACTIVITY_ICON_CLASSES[entry.status] ?? 'dashboard-page__activity-icon--brand',
            title: row.actionType,
            description: row.targetEntity,
            time: row.timestamp,
          };
        }),
      ),
    error: () => this.recentActivities.set([]),
  });
}
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
