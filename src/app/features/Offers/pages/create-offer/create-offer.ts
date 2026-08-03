import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OfferForm, OfferFormSubmit } from '../../../../shared/Components/offer-form/offer-form';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, OfferForm, TranslatePipe],
  templateUrl: './create-offer.html',
  styleUrl: './offer-form.scss',
})
export class CreateOffer {
  constructor(private readonly router: Router) {}

  save(event: OfferFormSubmit): void {
    // ponytail: no persistence layer yet; navigate back once it exists
    this.router.navigate(['/offers']);
  }

  saveDraft(event: OfferFormSubmit): void {
    // Navigate back for now
    this.router.navigate(['/offers']);
  }
}
