import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OfferDetails } from '../../Components/offer-details/offer-details';
import { PreviewOfferDetails } from '../../Components/preview-offer-details/preview-offer-details';

@Component({
  selector: 'app-offer-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink, OfferDetails, PreviewOfferDetails],
  templateUrl: './offer-details.html',
  styleUrl: './offer-details.scss',
})
export class OfferDetailsPage {
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id');

  // ponytail: placeholder offer/vendor/locations; load by id from a service when the API exists.
  readonly offer = {
    title: 'Summer Sale 2026',
    title_ar: 'تخفيضات الصيف 2026',
    description: 'Enjoy a limited-time discount across all participating branches this summer.',
    description_ar: 'استمتع بخصم لفترة محدودة في جميع الفروع المشاركة هذا الصيف.',
    startDate: new Date(2026, 0, 10).toISOString(),
    expiryDate: { $date: new Date(2026, 1, 10).toISOString() },
    category: { name: 'Retail', icon: 'pi pi-shopping-bag' },
    tags: ['Summer', 'Limited', 'Popular'],
    targetAudience: ['employees', 'Families'],
    discount_type: 'percentage',
    discount_amount: '50',
    discount_amount_ar: '٥٠',
    offerMode: 'both',
    howToAvail: 'Present your QR code or Aramco ID at the store.',
    howToAvail_ar: 'اعرض رمز الاستجابة السريعة الخاص بك أو بطاقة هوية أرامكو في المتجر.',
    mobile: '+966 50 123 4567',
    telephone: '+966 11 234 5678',
    email: 'offers@vendor.com',
    highlight_title: 'Best Seller',
    highlight_title_ar: 'الأكثر مبيعاً',
    highlight_description: 'Most redeemed offer of the season.',
    highlight_description_ar: 'العرض الأكثر استرداداً لهذا الموسم.',
  };

  readonly vendor = { name: 'Vendor Name', name_ar: 'اسم المتجر', logo: '' };

  readonly locations = [
    { branch_name: 'Main Branch', city: 'Dhahran', region: 'Eastern Province', country: 'Saudi Arabia', address: 'King Saud Rd' },
    { branch_name: 'City Center', city: 'Riyadh', region: 'Riyadh', country: 'Saudi Arabia', address: 'Olaya St' },
    { branch_name: 'Corniche', city: 'Jeddah', region: 'Makkah', country: 'Saudi Arabia', address: 'Corniche Rd' },
  ];
}
