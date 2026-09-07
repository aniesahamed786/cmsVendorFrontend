import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { BackButton } from '../../../../shared/Components/back-button/back-button';
import { OfferTile } from '../../../../shared/Components/offer-tile/offer-tile';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorQuickActions } from '../../components/vendor-quick-actions/vendor-quick-actions';
import { DashboardService } from '../../services/dashboard.service';
import { ActivityRow, toActivityPage } from '../../../recent-activities/models/system-log.mapper';
import { SystemLogService } from '../../../recent-activities/services/system-log.service';
import { createCountUp } from '../../../../shared/animation/count-up';
import { environment } from '../../../../../environments/environment';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { VendorProfileService } from '../../../Profile/pages/vendor-profile.service';
import { VendorProfileApi } from '../../../Profile/models/vendor-profile-request.mapper';

interface TopOfferData {
  offerId: string;
  offerTitle: string;
  offerTitleAr?: string;
  offerMode: string[];
  redemptions: number;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, BackButton, OfferTile, VendorQuickActions, TranslatePipe, TableModule, TooltipModule],
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
  topOfferLoading = signal(true);
  readonly skeletonStats = [0, 1, 2, 3];

  topOffer = signal<TopOfferData | null>(null);

  readonly displayOfferTitle = computed(() => {
    const offer = this.topOffer();
    if (!offer) return '';
    return this.localized(offer.offerTitle, offer.offerTitleAr);
  });

  readonly offerModeInfo = computed(() => {
    const offer = this.topOffer();
    if (!offer) return { labelKey: 'offers.value.online', icon: 'pi pi-globe' };
    const raw = Array.isArray(offer.offerMode)
      ? offer.offerMode.join(' ').toLowerCase()
      : String(offer.offerMode ?? '').toLowerCase();

    const hasDigital = raw.includes('digital') || raw.includes('online');
    const hasStore = raw.includes('store') || raw.includes('in store');

    if (hasDigital && hasStore) {
      return { labelKey: 'offers.value.hybridLong', icon: 'pi pi-globe' };
    }
    if (hasStore) {
      return { labelKey: 'offers.value.inStore', icon: 'pi pi-shop' };
    }
    return { labelKey: 'offers.value.online', icon: 'pi pi-globe' };
  });

  recentActivities = signal<ActivityRow[]>([]);
  activityLoading = signal(true);
  readonly tableRows = computed(() =>
    this.activityLoading() ? new Array(7).fill(null) : this.recentActivities(),
  );

  private readonly dashboardService = inject(DashboardService);
  private readonly systemLogs = inject(SystemLogService);
  private readonly vendorProfileService = inject(VendorProfileService);
  private readonly i18n = inject(I18nService);

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.loadVendorProfile();
    this.loadTopOffer();

    this.statsLoading.set(true);
    this.dashboardService
      .getDashboardStats()
      .pipe(finalize(() => this.statsLoading.set(false)))
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

    this.systemLogs.getSystemLogs({ page: 1, pageSize: 7, sortOrder: 'desc' })
      .pipe(finalize(() => this.activityLoading.set(false)))
      .subscribe({
        next: (res) => {
          const { rows } = toActivityPage(res);
          this.recentActivities.set(rows);
        },
        error: () => this.recentActivities.set([]),
      });
  }

  private loadTopOffer(): void {
    this.topOfferLoading.set(true);
    // Placeholder data until dedicated top-performing offer API is provided
    setTimeout(() => {
      this.topOffer.set({
        offerId: '',
        offerTitle: 'Summer Sale 2026',
        offerTitleAr: 'تخفيضات صيف 2026',
        offerMode: ['online'],
        redemptions: 0,
      });
      this.animateTo('topOfferRedemptions', 0);
      this.topOfferLoading.set(false);
    }, 200);
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

  goToTopOffer(): void {
    const id = this.topOffer()?.offerId;
    if (id) {
      this.router.navigate(['/offers', id]);
    } else {
      this.router.navigate(['/offers']);
    }
  }
}
