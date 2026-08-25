import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { OfferDetails } from '../../../Offers/Components/offer-details/offer-details';
import { OfferHeroCard, OfferHeroVendor } from '../../../Offers/Components/offer-hero-card/offer-hero-card';

@Component({
  selector: 'app-request-offer-detail',
  standalone: true,
  imports: [CommonModule, OfferHeroCard, OfferDetails],
  templateUrl: './request-offer-detail.html',
  styleUrl: './request-offer-detail.scss',
})
export class RequestOfferDetail {
  readonly offer = input<any>(null);
  readonly vendor = input<OfferHeroVendor>({ name: '', nameAr: '', logo: '' });
  readonly locations = input<Record<string, unknown>[]>([]);
  readonly loading = input<boolean>(false);
  readonly editedFields = input<Set<string>>(new Set<string>());
}
