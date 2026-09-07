import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { OfferListService } from './offer-list.service';

describe('OfferListService', () => {
  let service: OfferListService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OfferListService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends list search, filters, period, and sorting as query parameters', () => {
    service.getOffers({
      page: 2,
      pageSize: 20,
      search: 'صيف',
      discountType: 'percentage',
      status: 'Active',
      availability: 'hybrid',
      startDateFrom: '2026-08-01T00:00:00.000Z',
      startDateTo: '2026-08-31T23:59:59.999Z',
      sortBy: 'discount',
      sortOrder: 'desc',
    }).subscribe();

    const request = http.expectOne((req) => req.url.endsWith('/offers'));
    expect(request.request.params.get('search')).toBe('صيف');
    expect(request.request.params.get('availability')).toBe('hybrid');
    expect(request.request.params.get('sortBy')).toBe('discount');
    expect(request.request.params.get('sortOrder')).toBe('desc');
    request.flush({ data: [], total: 0, page: 2, pageSize: 20 });
  });
});
