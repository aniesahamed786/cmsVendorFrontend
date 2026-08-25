import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-hotel-rooms-list',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './hotel-room-card.html',
  styleUrl: './hotel-room-card.scss',
})
export class HotelRoomsListComponent {
  private readonly i18n = inject(I18nService);
  readonly iconBasePath = 'assets/svg/Offers/offer-details';

  rooms = input<any[]>([]);
  currency = input<string>('SAR');

  roomList = computed(() => {
    const r = this.rooms();
    return Array.isArray(r) ? r : [];
  });

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

  isSAR(curr: string | null | undefined): boolean {
    if (!curr) return true;
    const c = curr.trim().toUpperCase();
    return c === 'SAR' || c === 'SR' || c === 'ر.س';
  }
}
