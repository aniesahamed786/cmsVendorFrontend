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
  if (/^(blob:|data:)/i.test(value)) return value;

  const displayUrl = /^https?:/i.test(value)
    ? value
    : environment.backendUrl + value.replace('/api/v1/media/', '/api/v1/cmsVendor/media/');

  return decodeDoubleEncodedFilenameSegment(displayUrl);
}

/**
 * Messaging attachments with non-ASCII names can arrive with `%` encoded as `%25`.
 * Decode only the final path segment and only when that signature is present, leaving the
 * origin, route, query string, and normally encoded media URLs untouched.
 */
function decodeDoubleEncodedFilenameSegment(value: string): string {
  const suffixIndex = value.search(/[?#]/);
  const path = suffixIndex >= 0 ? value.slice(0, suffixIndex) : value;
  const suffix = suffixIndex >= 0 ? value.slice(suffixIndex) : '';
  const lastSlash = path.lastIndexOf('/');
  const filename = path.slice(lastSlash + 1);

  if (!/%25[0-9a-f]{2}/i.test(filename)) return value;

  try {
    return `${path.slice(0, lastSlash + 1)}${decodeURIComponent(filename)}${suffix}`;
  } catch {
    return value;
  }
}

/** A readable original filename for media chips, including legacy UTF-8/Latin-1 mojibake. */
export function mediaFilename(value: string): string {
  const withoutSuffix = value.split(/[?#]/, 1)[0];
  let filename = withoutSuffix.slice(withoutSuffix.lastIndexOf('/') + 1);

  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(filename);
      if (decoded === filename) break;
      filename = decoded;
    } catch {
      break;
    }
  }

  filename = repairUtf8Mojibake(filename);
  return filename.replace(/^\d+-/, '');
}

function repairUtf8Mojibake(value: string): string {
  const characters = Array.from(value);
  if (characters.some((character) => character.codePointAt(0)! > 0xff)) return value;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(characters, (character) => character.charCodeAt(0)),
    );
  } catch {
    return value;
  }
}
