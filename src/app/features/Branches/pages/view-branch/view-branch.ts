import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { toEditableBranchData } from '../../models/branch-edit.mapper';
import { RequestCenterRequestRecord } from '../../models/request-center-request.model';
import { BranchApiPayload } from '../branch-form/branch-form';

@Component({
  selector: 'app-view-branch',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, RouterLink, TranslatePipe],
  templateUrl: './view-branch.html',
  styleUrl: './view-branch.scss',
})
export class ViewBranch {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  private readonly requestsBaseUrl = '/api/v1/cmsVendor/getStoreDetails';

  readonly id = this.route.snapshot.paramMap.get('id');

  readonly branch = signal<BranchApiPayload | null>(null);
  readonly loading = signal(true);

  readonly hasCoordinates = computed(() => {
    const coords = this.branch()?.geoPoint?.coordinates;
    return !!coords && (coords[0] !== 0 || coords[1] !== 0);
  });

  constructor() {
    if (this.id) {
      this.loadBranch(this.id);
    } else {
      this.loading.set(false);
    }
  }

  private loadBranch(requestId: string): void {
    this.loading.set(true);
    this.http
      .get<any>(`${this.requestsBaseUrl}/${requestId}`)
      .subscribe({
        next: (request:any) => {
          let formattedRequest = {
          branch_name: request.locationName,
          branch_name_ar: request.locationNameAr,
          country: request.country,
          country_ar: request.countryAr,
          region: request.region,
          region_ar: request.regionAr,
          city: request.city,
          city_ar: request.cityAr,
          address: request.address,
          link: request.googleMapLink,
          branchRepresentativeName: request.representativeName,
          branchPhoneNumber: request.representativePhoneNumber,
          // settingsLocationId: asText(model.settingsLocationId),
          // geoPoint: model.geoPoint ?? DEFAULT_GEOPOINT,
        };
          this.branch.set(toEditableBranchData(formattedRequest));
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load branch for viewing', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('branchForm.toast.loadFailed'),
            detail: this.i18n.t('branchForm.toast.loadFailedDetail'),
            life: 5000,
            closable: true,
          });
        },
      });
  }
}