import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OfferForm } from '../../../../shared/Components/offer-form/offer-form';

@Component({
  selector: 'app-edit-offer',
  standalone: true,
  imports: [CommonModule, OfferForm],
  templateUrl: './edit-offer.html',
  styleUrl: '../create-offer/offer-form.scss',
})
export class EditOffer {
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id');

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
