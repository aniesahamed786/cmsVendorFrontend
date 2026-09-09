/**
 * Localised "7d ago" for the notification bell. Uses Intl so neither language
 * needs hand-written strings; Arabic keeps Latin digits (see I18nService.numberLocale).
 */
export function timeAgo(iso: string, isArabic: boolean, now: number = Date.now()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const format = new Intl.RelativeTimeFormat(isArabic ? 'ar-u-nu-latn' : 'en', {
    numeric: 'auto',
    style: 'narrow',
  });

  const minutes = Math.round((date.getTime() - now) / 60000);
  if (minutes > -1) return format.format(0, 'minute');
  if (minutes > -60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}
