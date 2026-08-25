import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

import { HotelRoomsListComponent } from '../hotel-room-card/hotel-room-card';

@Component({
  selector: 'app-hotel-details',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, TranslatePipe, HotelRoomsListComponent],
  templateUrl: './hotel-details.html',
  styleUrl: './hotel-details.scss',
})
export class HotelDetailsComponent {
  private readonly i18n = inject(I18nService);
  readonly iconBasePath = 'assets/svg/Offers/offer-details';
  hotelDetails = input<any>(null);
  isEdited = input<boolean>(false);

  private rawHotel = computed(() => {
    const d = this.hotelDetails();
    return d?.hotel_details || d?.hotelDetails || d || {};
  });

  getRoomDetails(): any[] {
    const h = this.rawHotel();
    const rooms = h?.roomDetails || (Array.isArray(h?.rooms) ? h.rooms : []);
    return Array.isArray(rooms) ? rooms : [];
  }

  getRoomName(room: any): string {
    const isAr = this.i18n.lang() === 'ar';
    if (isAr) {
      return room?.roomNameAr || room?.roomName || room?.name || '';
    }
    return room?.roomName || room?.roomNameAr || room?.name || '';
  }

  getSeasonName(rate: any): string {
    const isAr = this.i18n.lang() === 'ar';
    if (isAr) {
      return rate?.seasonAr || rate?.season || rate?.name || '';
    }
    return rate?.season || rate?.seasonAr || rate?.name || '';
  }

  getRateValue(rate: any): string {
    const v = rate?.value ?? rate?.rate ?? rate?.price ?? '';
    return String(v).trim();
  }

  hasRateValue(rate: any): boolean {
    const v = rate?.value ?? rate?.rate ?? rate?.price;
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  getAmenities(): string[] {
    const h = this.rawHotel();
    const isAr = this.i18n.lang() === 'ar';
    const raw = isAr
      ? h?.hotelAmenitites_ar || h?.hotelAmenities_ar || h?.hotelAmenitites || h?.hotelAmenities || []
      : h?.hotelAmenitites || h?.hotelAmenities || h?.hotelAmenitites_ar || h?.hotelAmenities_ar || [];

    const list: string[] = [];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') {
          const parts = item.split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
          list.push(...parts);
        }
      }
    } else if (typeof raw === 'string') {
      const parts = raw.split(/[,،]+/).map((s) => s.trim()).filter(Boolean);
      list.push(...parts);
    }
    return list;
  }

  getTaxValue(): string {
    const h = this.rawHotel();
    return h?.taxValue || h?.tax_value || '';
  }

  getTaxValueAr(): string {
    const h = this.rawHotel();
    return h?.taxValue_ar || h?.tax_value_ar || '';
  }

  getCombinedTaxValue(): string {
    const en = this.getTaxValue();
    const ar = this.getTaxValueAr();
    if (en && ar) {
      return `${en} | ${ar}`;
    }
    return en || ar || '';
  }

  getCurrency(): string {
    const h = this.rawHotel();
    const isAr = this.i18n.lang() === 'ar';
    return isAr
      ? (h?.currency_ar || h?.currency || 'SAR')
      : (h?.currency || h?.currency_ar || 'SAR');
  }

  isSAR(currency: string | null | undefined): boolean {
    if (!currency) return true;
    const c = currency.trim().toUpperCase();
    return c === 'SAR' || c === 'SR' || c === 'ر.س';
  }
}
