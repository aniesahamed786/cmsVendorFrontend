import { TestBed } from '@angular/core/testing';

import { OfferDetailService } from './offer-detail.service';

describe('OfferDetailService', () => {
  let service: OfferDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfferDetailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
