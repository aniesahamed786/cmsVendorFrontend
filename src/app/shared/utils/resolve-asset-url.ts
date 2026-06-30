/**
 * Resolves static asset paths for templates (mask-image, img src).
 * Uses the document base URI so icons work when the app is deployed under a subpath.
 */
export function resolveAssetUrl(document: Document, assetPath: string): string {
  if (!assetPath) {
    return '';
  }

  const trimmed = assetPath.trim();
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  const normalized = withoutLeadingSlash.startsWith('assets/')
    ? withoutLeadingSlash
    : `assets/${withoutLeadingSlash}`;

  return new URL(normalized, document.baseURI).href;
}

/** CSS `mask-image` / `-webkit-mask-image` value with a resolved absolute asset URL. */
export function resolveMaskImageStyle(document: Document, assetPath: string): string {
  const href = resolveAssetUrl(document, assetPath);
  return href ? `url("${href}")` : 'none';
}

/** Upload placeholder icon (vendor / offer / highlight / notification forms). */
export const UPLOAD_IMAGE_ICON_ASSET = 'svg/vendors/add-vendor/ic-upload-image.svg';

export function resolveUploadIconMaskStyle(document: Document): string {
  return resolveMaskImageStyle(document, UPLOAD_IMAGE_ICON_ASSET);
}

/** Upload placeholder icon on banner create/edit forms. */
export const BANNER_UPLOAD_IMAGE_ICON_ASSET = 'svg/banners/add-banners/ic-upload-image.svg';

export function resolveBannerUploadIconMaskStyle(document: Document): string {
  return resolveMaskImageStyle(document, BANNER_UPLOAD_IMAGE_ICON_ASSET);
}
