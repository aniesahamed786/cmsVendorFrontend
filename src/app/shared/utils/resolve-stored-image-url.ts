import { environment } from '../../../environments/environment';

// ponytail: vendor has no CDN base; pass through absolute/data/blob and local
// assets, prefix other stored relative paths with apiBaseUrl. Point at a real
// asset/CDN base here once the offers API exposes one.
export function resolveStoredImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = String(path).trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (/^\/?assets\//i.test(trimmed)) return trimmed.replace(/^\/+/, '');
  return `${environment.backendUrl}${environment.apiBaseUrl.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
}
