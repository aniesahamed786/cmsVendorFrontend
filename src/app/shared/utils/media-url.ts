import { environment } from '../../../environments/environment';

/**
 * Display URL for an image path as the API stores it.
 *
 * Stored media paths are relative and unscoped (`/api/v1/media/...`), which is what has to go
 * back in a payload — but they are not directly servable to a vendor: their media is proxied
 * under `/api/v1/cmsVendor/media/` on the backend origin. Anything already absolute (`http`,
 * `blob:` from a freshly picked file, `data:`) is passed through untouched.
 *
 * Keep this at the render boundary only. Rewriting a value before it reaches a form control
 * would put the display URL into the saved payload.
 */
export function toVendorMediaUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  return environment.backendUrl + value.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');
}
