import { TestBed } from '@angular/core/testing';

import { OfferListService } from './offer-list.service';

describe('OfferListService', () => {
  let service: OfferListService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfferListService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
