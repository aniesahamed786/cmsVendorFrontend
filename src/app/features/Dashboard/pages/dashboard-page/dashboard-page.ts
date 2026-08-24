import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';
import { DashboardService } from '../../services/dashboard.service';
import { toActivityRow } from '../../../recent-activities/models/system-log.mapper';
import { SystemLogService } from '../../../recent-activities/services/system-log.service';
import { createCountUp } from '../../../../shared/animation/count-up';
import { environment } from '../../../../../environments/environment';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { VendorProfileService } from '../../../Profile/pages/vendor-profile.service';
import { VendorProfileApi } from '../../../Profile/models/vendor-profile-request.mapper';
import { RequestCenterApiService } from '../../../request-center/services/request-center-api.service';
import { INCOMPLETE_STATUSES, RequestStatus } from '../../../request-center/models/request.model';
import { toRequestRow } from '../../../request-center/models/request.mapper';

interface RecentActivityItem {
  icon: string;
  iconClass: string;
  title: string;
  description: string;
  time: string;
}

interface PendingRequestItem {
  id: string;
  title: string;
  subtitle: string;
  status: RequestStatus;
  time: string;
  icon: string;
  iconClass: string;
}

const ACTIVITY_ICONS: Record<string, string> = {
  OFFER: 'assets/svg/Navbar/ic-offer.svg',
  STORE: 'assets/svg/Navbar/ic-vendor.svg',
  BRANCH: 'assets/svg/Navbar/ic-vendor.svg',
  PROFILE: 'assets/svg/Navbar/ic-vendor.svg',
  VENDOR: 'assets/svg/Navbar/ic-vendor.svg',
  HIGHLIGHT: 'assets/svg/Navbar/ic-highlights.svg',
  BANNER: 'assets/svg/Navbar/ic-banner.svg',
  NOTIFICATION: 'assets/svg/Navbar/ic-notification.svg',
  REQUEST: 'assets/svg/Navbar/ic-requests.svg',
  DEFAULT: 'assets/svg/Navbar/ic-log.svg',
};

const ACTIVITY_ICON_CLASSES: Record<string, string> = {
  APPROVED: 'dashboard-page__activity-icon--approved',
  SUBMITTED: 'dashboard-page__activity-icon--submitted',
  PENDING: 'dashboard-page__activity-icon--pending',
  DRAFT: 'dashboard-page__activity-icon--draft',
  RETURNED: 'dashboard-page__activity-icon--returned',
  REJECTED: 'dashboard-page__activity-icon--rejected',
  RECALLED: 'dashboard-page__activity-icon--recalled',
  CANCELLED: 'dashboard-page__activity-icon--cancelled',
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

  // Incomplete requests fetched for the Pending Requests panel
  pendingRequests = signal<PendingRequestItem[]>([]);

  // ponytail: server copy is English-only; times stay absolute like the
  // recent-activities table. Relative "2 mins ago" wants Intl.RelativeTimeFormat.
  recentActivities = signal<RecentActivityItem[]>([]);
  activityLoading = signal(true);
  readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly dashboardService = inject(DashboardService);
  private readonly systemLogs = inject(SystemLogService);
  private readonly vendorProfileService = inject(VendorProfileService);
  private readonly requestCenterApi = inject(RequestCenterApiService);
  private readonly i18n = inject(I18nService);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.loadVendorProfile();
    this.loadPendingRequests();

    this.statsLoading.set(true);
    this.dashboardService
      .getDashboardStats()
      .pipe(finalize(() => this.statsLoading.set(false)))
      .subscribe({
        next: (stats) => {
          this.dashboardStats.set(stats);
          this.animateTo('totalRedemptions', stats?.totalRedemptions ?? 0);
          this.animateTo('activeOffers', stats?.activeOffers ?? 0);
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
              const statusKey = String(entry.status ?? '').toUpperCase();
              return {
                icon: ACTIVITY_ICONS[String(entry.entityType ?? '').toUpperCase()] ?? 'assets/svg/Navbar/ic-log.svg',
                iconClass:
                  ACTIVITY_ICON_CLASSES[statusKey] ?? 'dashboard-page__activity-icon--white',
                title: row.actionType,
                description: row.targetEntity,
                time: row.timestamp,
              };
            }),
          ),
        error: () => this.recentActivities.set([]),
      });
  }

  private loadPendingRequests(): void {
    this.pendingRequestsLoading.set(true);
    this.requestCenterApi
      .list({
        page: 1,
        pageSize: 5,
        sortBy: 'updatedOn',
        sortOrder: 'desc',
        status: INCOMPLETE_STATUSES,
      })
      .pipe(finalize(() => this.pendingRequestsLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.animateTo('pendingRequests', res.total);
          this.pendingRequests.set(
            (res.data ?? []).map((summary) => {
              const row = toRequestRow(summary);
              const statusKey = String(row.status ?? '').toUpperCase();
              return {
                id: row.rowKey,
                title: row.targetEntity,
                subtitle: `${this.i18n.t(`requestCenter.type.${row.type.toLowerCase()}`)} • ${this.i18n.t(`requestCenter.actionType.${row.actionType.toLowerCase()}`)}`,
                status: row.status,
                time: row.timestamp,
                icon: ACTIVITY_ICONS[String(summary.entityType ?? '').toUpperCase()] ?? 'assets/svg/Navbar/ic-requests.svg',
                iconClass:
                  ACTIVITY_ICON_CLASSES[statusKey] ?? 'dashboard-page__activity-icon--white',
              };
            }),
          );
        },
        error: (err) => {
          console.error('Failed to load pending requests for dashboard', err);
          this.pendingRequests.set([]);
        },
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

  goToRequestDetails(rowKey: string): void {
    this.router.navigate(['/request-center', rowKey]);
  }

  statusClass(status: RequestStatus): string {
    return `dashboard-page__status dashboard-page__status--${status.toLowerCase()}`;
  }

  statusKey(status: RequestStatus): string {
    return `requestCenter.value.${status.toLowerCase()}`;
  }
}
