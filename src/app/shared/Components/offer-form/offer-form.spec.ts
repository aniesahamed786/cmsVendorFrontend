import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferForm } from './offer-form';

describe('OfferForm', () => {
  let component: OfferForm;
  let fixture: ComponentFixture<OfferForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfferForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
