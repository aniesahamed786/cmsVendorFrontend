import { Component, input } from '@angular/core';
import { toVendorMediaUrl } from '../../../../shared/utils/media-url';

/**
 * The brand banner at the top of a vendor profile: logo plate, name, Arabic name.
 *
 * Extracted from the vendor profile page so the Request Center shows a pending PROFILE
 * request under the identical header — a request is reviewed by looking at the profile as it
 * will appear, and a second hand-built copy of this would drift the first time either moved.
 *
 * Page-specific actions (the profile page's Edit button) are projected in via `[hero-action]`,
 * so the banner itself stays free of anything only one host needs.
 */
@Component({
  selector: 'app-vendor-hero-card',
  standalone: true,
  templateUrl: './vendor-hero-card.html',
  styleUrl: './vendor-hero-card.scss',
})
export class VendorHeroCard {
  name = input<string>('');
  nameAr = input<string>('');
  /** Stored media path or absolute URL; resolved onto the vendor media proxy for display. */
  logo = input<string>('');

  logoUrl(): string {
    return toVendorMediaUrl(this.logo());
  }
}
