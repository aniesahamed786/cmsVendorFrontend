import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorHeroCard } from '../../../Profile/components/vendor-hero-card/vendor-hero-card';
import { ProfileRequestView } from '../../models/request-entity-view.mapper';
import { environment } from '../../../../../environments/environment';
import { resolveAssetUrl, resolveMaskImageStyle } from '../../../../shared/utils/resolve-asset-url';

@Component({
  selector: 'app-request-profile-detail',
  standalone: true,
  imports: [CommonModule, TranslatePipe, VendorHeroCard],
  templateUrl: './request-profile-detail.html',
  styleUrl: './request-profile-detail.scss',
})
export class RequestProfileDetail {
  private readonly document = inject(DOCUMENT);

  readonly profile = input.required<ProfileRequestView>();

  /** Same media-path rewrite the vendor profile page uses. */
  imageUrl(path: string): string {
    if (!path) return '';
    return environment.backendUrl + path.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
  }

  getVendorIconMask(iconName: string): string {
    return resolveMaskImageStyle(this.document, `svg/vendors/add-vendor/${iconName}`);
  }

  getSocialLinkUrl(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object' && typeof (value as any).url === 'string') {
      return (value as any).url.trim();
    }
    return '';
  }

  getExternalLinkHref(value: unknown): string {
    const url = this.getSocialLinkUrl(value);
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  getSocialPlatform(value: unknown): string {
    if (value && typeof value === 'object') {
      const link = value as Record<string, unknown>;
      const p = String(link['platform'] ?? link['type'] ?? link['platformType'] ?? '').trim().toLowerCase();
      if (p) return p === 'twitter' ? 'x' : p;
    }
    const url = this.getSocialLinkUrl(value).toLowerCase();
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
    if (url.includes('x.com') || url.includes('twitter.com')) return 'x';
    if (url.includes('whatsapp') || url.includes('wa.me')) return 'whatsapp';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('linkedin.com')) return 'linkedin';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('snapchat.com')) return 'snapchat';
    return '';
  }

  getSocialLinkIconPath(value: unknown): string | null {
    const platform = this.getSocialPlatform(value);
    switch (platform) {
      case 'instagram': return resolveAssetUrl(this.document, 'svg/social-media/ic-instagram.svg');
      case 'linkedin': return resolveAssetUrl(this.document, 'svg/social-media/linkedin.svg');
      case 'facebook': return resolveAssetUrl(this.document, 'svg/social-media/ic-facebook.svg');
      case 'tiktok': return resolveAssetUrl(this.document, 'svg/social-media/tiktok.svg');
      case 'youtube': return resolveAssetUrl(this.document, 'svg/social-media/youtube.svg');
      case 'snapchat': return resolveAssetUrl(this.document, 'svg/social-media/ic-snapchat.svg');
      case 'whatsapp': return resolveAssetUrl(this.document, 'svg/social-media/whatspp.svg');
      case 'x': return resolveAssetUrl(this.document, 'svg/social-media/X.svg');
      default: return null;
    }
  }

  formatSocialLinkLabel(value: unknown): string {
    if (value && typeof value === 'object' && typeof (value as any).accountName === 'string' && (value as any).accountName.trim()) {
      return (value as any).accountName.trim();
    }
    const url = this.getSocialLinkUrl(value);
    if (!url) return '';
    const withoutQuery = url.split('?')[0];
    const normalizedValue = /^https?:\/\//i.test(withoutQuery) ? withoutQuery : `https://${withoutQuery}`;
    try {
      const parsed = new URL(normalizedValue);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
      const pathParts = path.split('/').filter(Boolean);
      const hostname = parsed.hostname.replace(/^www\./, '');

      if (hostname.includes('linkedin.com') && pathParts[0]?.toLowerCase() === 'in' && pathParts[1]) {
        return pathParts[1];
      }
      if (hostname.includes('tiktok.com')) {
        const username = pathParts.find((p) => p.startsWith('@'));
        if (username) return username;
      }
      if (hostname.includes('snapchat.com') && pathParts[0]?.toLowerCase() === 'add' && pathParts[1]) {
        return pathParts[1];
      }
      return pathParts[pathParts.length - 1] || hostname;
    } catch {
      const fallbackParts = withoutQuery
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter(Boolean);
      return fallbackParts[fallbackParts.length - 1] || withoutQuery;
    }
  }
}
