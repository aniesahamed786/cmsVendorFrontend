import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { PrimeUIModules } from '../../../../core/prime.import';

// ponytail: admin source for hotel-details wasn't provided; minimal port covering
// the documented shape (roomDetails / amenities / tax / currency). Extend if the
// admin component exposes more fields.
@Component({
  selector: 'app-hotel-details',
  standalone: true,
  imports: [CommonModule, PrimeUIModules],
  templateUrl: './hotel-details.html',
  styleUrl: './hotel-details.scss',
})
export class HotelDetailsComponent {
  readonly iconBasePath = 'assets/svg/Offers/offer-details';
  hotelDetails = input<any>(null);

  getRoomDetails(): any[] {
    return Array.isArray(this.hotelDetails()?.roomDetails) ? this.hotelDetails().roomDetails : [];
  }

  getAmenities(): string[] {
    const h = this.hotelDetails();
    const raw = h?.hotelAmenitites || h?.hotelAmenities || [];
    return Array.isArray(raw) ? raw.filter((a: unknown) => typeof a === 'string' && a.trim()) : [];
  }

  getTaxValue(): string {
    return this.hotelDetails()?.taxValue || '';
  }

  getCurrency(): string {
    return this.hotelDetails()?.currency || 'SAR';
  }

  isSAR(currency: string | null | undefined): boolean {
    return currency?.toUpperCase() === 'SAR';
  }
}
