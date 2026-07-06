import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OfferForm } from '../../../../shared/Components/offer-form/offer-form';

@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, OfferForm],
  templateUrl: './create-offer.html',
  styleUrl: './offer-form.scss',
})
export class CreateOffer {
  constructor(private readonly router: Router) {}

  save(event: any): void {
    // ponytail: no persistence layer yet; navigate back once it exists
    this.router.navigate(['/offers']);
  }

  saveDraft(event: any): void {
    // Navigate back for now
    this.router.navigate(['/offers']);
  }
}
