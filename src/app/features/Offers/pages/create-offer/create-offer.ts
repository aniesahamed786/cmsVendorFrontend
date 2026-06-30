import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';

@Component({
  selector: 'app-create-offer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PrimeUIModules],
  templateUrl: './create-offer.html',
  styleUrl: './offer-form.scss',
})
export class CreateOffer {
  // ponytail: local form state; wire to a service when the API exists
  readonly title = signal('');
  readonly discount = signal('');
  readonly discountType = signal<string | null>(null);
  readonly availability = signal<string | null>(null);
  readonly branch = signal<string | null>(null);
  readonly startDate = signal<Date | null>(null);
  readonly expirationDate = signal<Date | null>(null);
  readonly status = signal<string | null>(null);

  readonly discountTypeOptions = [
    { label: 'Percentage', value: 'Percentage' },
    { label: 'Fixed Amount', value: 'Fixed Amount' },
  ];
  readonly availabilityOptions = [
    { label: 'Online', value: 'Online' },
    { label: 'In-Store', value: 'In-Store' },
    { label: 'Hybrid', value: 'Hybrid' },
  ];
  readonly branchOptions = [
    { label: 'Main Branch', value: 'Main Branch' },
    { label: 'Downtown', value: 'Downtown' },
    { label: 'Mall', value: 'Mall' },
  ];
  readonly statusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Scheduled', value: 'Scheduled' },
    { label: 'Expired', value: 'Expired' },
  ];

  constructor(private readonly router: Router) {}

  save(): void {
    // ponytail: no persistence layer yet; navigate back once it exists
    this.router.navigate(['/offers']);
  }
}
