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
