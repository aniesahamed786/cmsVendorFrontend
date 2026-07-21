import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-redemption',
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules, Button, TranslatePipe],
  templateUrl: './redemption.html',
  styleUrl: './redemption.css',
})
export class Redemption {
  redemptionForm: FormGroup;
  
  offers = [
    { label: '10% Off on First Purchase', value: '10-off' },
    { label: 'Buy 1 Get 1 Free', value: 'bogo' },
    { label: 'Summer Special', value: 'summer' },
    { label: 'Exclusive Discount', value: 'exclusive' }
  ];

  branches = [
    { label: 'Dammam Branch', value: 'dammam' },
    { label: 'Riyadh Branch', value: 'riyadh' },
    { label: 'Jeddah Branch', value: 'jeddah' }
  ];

  redemptions = [
    { userId: 'USR-2026-1009', offer: '10% Off on First Purchase', currentPrice: 250, discountPrice: 225, amountSaved: 25 },
    { userId: 'USR-2026-1176', offer: 'Buy 1 Get 1 Free', currentPrice: 350, discountPrice: 175, amountSaved: 175 },
    { userId: 'USR-2026-1267', offer: 'Summer Special', currentPrice: 200, discountPrice: 180, amountSaved: 20 },
    { userId: 'USR-2026-1289', offer: 'Exclusive Discount', currentPrice: 220, discountPrice: 150, amountSaved: 70 },
  ];

  constructor(private fb: FormBuilder) {
    this.redemptionForm = this.fb.group({
      userId: ['CMSV67363', Validators.required],
      offer: [null, Validators.required],
      branch: [null, Validators.required],
      totalAmount: ['', Validators.required],
      paidAmount: ['', Validators.required]
    });
  }
}
