import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';
import { DashboardService } from '../../services/dashboard.service';
import { OnInit, inject } from '@angular/core';
import { toActivityRow } from '../../../recent-activities/models/system-log.mapper';
import { SystemLogService } from '../../../recent-activities/services/system-log.service';
import { createCountUp } from '../../../../shared/animation/count-up';
import { environment } from '../../../../../environments/environment';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { VendorProfileService } from '../../../Profile/pages/vendor-profile.service';
import { VendorProfileApi } from '../../../Profile/models/vendor-profile-request.mapper';

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
  private readonly countUp = createCountUp();
  readonly animatedCount = this.countUp.animatedCount;
  private readonly animateTo = this.countUp.animateTo;

  headerLoading = signal(true);
  private readonly vendorProfile = signal<VendorProfileApi | null>(null);
  readonly vendorName = computed(() =>
    this.localized(this.vendorProfile()?.vendorName, this.vendorProfile()?.vendorNameAr),
  );
  readonly vendorDescription = computed(() =>
    this.localized(this.vendorProfile()?.description, this.vendorProfile()?.descriptionAr),
  );
  readonly vendorLogo = computed(() => this.mediaUrl(this.vendorProfile()?.vendorLogo));
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
  private readonly vendorProfileService = inject(VendorProfileService);
  private readonly i18n = inject(I18nService);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.loadVendorProfile();

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
          this.animateTo('totalRedemptions', stats?.totalRedemptions ?? 0);
          this.animateTo('activeOffers', stats?.activeOffers ?? 0);
          this.animateTo('pendingRequests', stats?.pendingRequests ?? 0);
          this.animateTo('expiringSoonOffers', stats?.expiringSoonOffers ?? 0);
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

  private loadVendorProfile(): void {
    this.headerLoading.set(true);
    this.vendorProfileService
      .getVendorProfile()
      .pipe(finalize(() => this.headerLoading.set(false)))
      .subscribe({
        next: (profile) => this.vendorProfile.set(profile ?? null),
        error: (err) => {
          this.vendorProfile.set(null);
        },
      });
  }

  readonly vendorInitials = computed(() => {
    const name = this.vendorName().trim();
    if (!name) return '—';
    return name.slice(0, 6).toUpperCase();
  });

  private localized(en: string | undefined, ar: string | undefined): string {
    const value = this.i18n.lang() === 'ar' ? ar || en : en || ar;
    return (value ?? '').trim();
  }

  private mediaUrl(path: string | undefined): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return environment.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
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
