import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { resolveAssetUrl } from '../../utils/resolve-asset-url';
import { PrimeUIModules } from '../../../core/prime.import';

@Component({
  selector: 'app-offer-tile',
  imports: [CommonModule, PrimeUIModules],
  templateUrl: './offer-tile.html',
  styleUrl: './offer-tile.css',
})
export class OfferTile {
  private readonly document = inject(DOCUMENT);

  title = input<string>('');
  value = input<string | number>('');
  subtitle = input<string>('');
  icon = input<string>('pi pi-chart-bar');
  bgColor = input<string>('bg-white');
  iconColor = input<string>('');
  iconContainerBg = input<string>('');
  trendLabel = input<string>('');
  trendUp = input<boolean>(true);
  badgeLabel = input<string>('');
  iconSizeClass = input<string>('text-lg');
  iconContainerSizeClass = input<string>('w-10 h-10');
  tileClick = output<void>();

  isSvgIcon(icon: string | null | undefined): boolean {
    return typeof icon === 'string' && icon.trim().toLowerCase().includes('.svg');
  }

  resolveIconUrl(icon: string | null | undefined): string {
    if (!icon) {
      return '';
    }
    return this.isSvgIcon(icon) ? resolveAssetUrl(this.document, icon) : icon;
  }
}
