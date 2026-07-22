import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrimeUIModules } from '../../../core/prime.import';
import { VendorProfileEditLocation } from '../../../features/Profile/models/vendor-profile-edit.model';
import { Button } from '../button/button';
import { CancelButton } from '../cancel-button/cancel-button';

@Component({
  selector: 'app-vendor-location-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules, Button, CancelButton],
  templateUrl: './vendor-location-dialog.html',
  styleUrl: './vendor-location-dialog.css',
})
export class VendorLocationDialog implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() locationToEdit: VendorProfileEditLocation | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saveLocation = new EventEmitter<VendorProfileEditLocation>();

  readonly countryOptions = ['Saudi Arabia', 'United Arab Emirates', 'Bahrain', 'Kuwait', 'Oman', 'Qatar'];
  readonly regionOptions = ['Eastern Region', 'Riyadh Region', 'Makkah Region', 'Madinah Region', 'Qassim Region', 'Asir Region'];
  readonly cityOptions = ['Dammam', 'Khobar', 'Dhahran', 'Riyadh', 'Jeddah', 'Makkah', 'Medina'];

  locationForm = this.fb.group({
    locationNameEn: ['', Validators.required],
    locationNameAr: ['', Validators.required],
    country: ['Saudi Arabia', Validators.required],
    region: [''],
    city: [''],
    address: ['', Validators.required],
    mapLink: [''],
    locationRepresentativeName: [''],
    locationPhone: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      if (this.locationToEdit) {
        this.locationForm.patchValue({
          locationNameEn: this.locationToEdit.nameEn,
          locationNameAr: this.locationToEdit.nameAr,
          country: this.locationToEdit.country,
          region: this.locationToEdit.region,
          city: this.locationToEdit.city,
          address: this.locationToEdit.address,
          mapLink: this.locationToEdit.mapLink,
          locationRepresentativeName: this.locationToEdit.representativeName,
          locationPhone: this.locationToEdit.phone,
        });
      } else {
        this.locationForm.reset({ country: 'Saudi Arabia' });
      }
    }
  }

  close() {
    this.visibleChange.emit(false);
    this.locationForm.reset({ country: 'Saudi Arabia' });
  }

  submit() {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }
    const val = this.locationForm.value;
    const newLocation: VendorProfileEditLocation = {
      id: this.locationToEdit ? this.locationToEdit.id : `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nameEn: val.locationNameEn ?? '',
      nameAr: val.locationNameAr ?? '',
      country: val.country ?? '',
      region: val.region ?? '',
      city: val.city ?? '',
      address: val.address ?? '',
      mapLink: val.mapLink ?? '',
      representativeName: val.locationRepresentativeName ?? '',
      phone: val.locationPhone ?? '',
    };
    
    this.saveLocation.emit(newLocation);
    this.close();
  }
}
