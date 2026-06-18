import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import {
  VendorProfileEditData,
  VendorProfileEditLocation,
} from '../../models/vendor-profile-edit.model';

export interface VendorProfilePreviewData {
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  email: string;
  contact: string;
  businessWebsite: string;
  locations: VendorProfileEditLocation[];
}

@Component({
  selector: 'app-vendor-profile-edit-form',
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules],
  templateUrl: './vendor-profile-edit-form.html',
  styleUrl: './vendor-profile-edit-form.css',
})
export class VendorProfileEditForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  initialData = input<VendorProfileEditData>(MOCK_VENDOR_PROFILE_EDIT);
  isLoading = input(false);

  saveDraft = output<VendorProfileEditData>();
  updateChanges = output<VendorProfileEditData>();

  readonly savedLocations = signal<VendorProfileEditLocation[]>([]);
  readonly previewData = signal<VendorProfilePreviewData>({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    email: '',
    contact: '',
    businessWebsite: '',
    locations: [],
  });
  readonly previewSocialLinks = signal<string[]>([]);

  readonly profileForm = this.fb.group({
    nameEn: ['', Validators.required],
    nameAr: ['', Validators.required],
    crNumber: [''],
    descriptionEn: ['', Validators.required],
    descriptionAr: ['', Validators.required],
    businessPhone: ['', Validators.required],
    businessEmail: ['', [Validators.required, Validators.email]],
    businessWebsite: [''],
    repFullName: ['', Validators.required],
    repPhone: ['', Validators.required],
    repEmail: ['', [Validators.required, Validators.email]],
    locationNameEn: [''],
    locationNameAr: [''],
    country: ['Saudi Arabia'],
    region: [''],
    city: [''],
    address: [''],
    mapLink: [''],
    locationRepresentativeName: [''],
    locationPhone: [''],
  });

  ngOnInit(): void {
    this.patchForm(this.initialData());
    this.savedLocations.set([...this.initialData().locations]);
    this.previewSocialLinks.set([...this.initialData().socialLinks]);
    this.syncPreview();

    this.profileForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncPreview());
  }

  private patchForm(data: VendorProfileEditData): void {
    this.profileForm.patchValue({
      nameEn: data.nameEn,
      nameAr: data.nameAr,
      crNumber: data.crNumber,
      descriptionEn: data.descriptionEn,
      descriptionAr: data.descriptionAr,
      businessPhone: data.businessPhone,
      businessEmail: data.businessEmail,
      businessWebsite: data.businessWebsite,
      repFullName: data.repFullName,
      repPhone: data.repPhone,
      repEmail: data.repEmail,
    });
  }

  private syncPreview(): void {
    const value = this.profileForm.getRawValue();
    this.previewData.set({
      nameEn: value.nameEn ?? '',
      nameAr: value.nameAr ?? '',
      descriptionEn: value.descriptionEn ?? '',
      descriptionAr: value.descriptionAr ?? '',
      email: value.businessEmail ?? '',
      contact: value.businessPhone ?? '',
      businessWebsite: value.businessWebsite ?? '',
      locations: this.savedLocations(),
    });
  }

  private buildPayload(): VendorProfileEditData {
    const value = this.profileForm.getRawValue();
    return {
      nameEn: value.nameEn ?? '',
      nameAr: value.nameAr ?? '',
      crNumber: value.crNumber ?? '',
      descriptionEn: value.descriptionEn ?? '',
      descriptionAr: value.descriptionAr ?? '',
      businessPhone: value.businessPhone ?? '',
      businessEmail: value.businessEmail ?? '',
      businessWebsite: value.businessWebsite ?? '',
      repFullName: value.repFullName ?? '',
      repPhone: value.repPhone ?? '',
      repEmail: value.repEmail ?? '',
      socialLinks: this.previewSocialLinks(),
      locations: this.savedLocations(),
    };
  }

  onSaveDraft(): void {
    this.saveDraft.emit(this.buildPayload());
  }

  onUpdateChanges(): void {
    this.updateChanges.emit(this.buildPayload());
  }

  addLocation(): void {
    const value = this.profileForm.getRawValue();
    if (!value.locationNameEn?.trim() || !value.address?.trim()) {
      return;
    }

    const nextLocation: VendorProfileEditLocation = {
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nameEn: value.locationNameEn ?? '',
      nameAr: value.locationNameAr ?? '',
      country: value.country ?? '',
      region: value.region ?? '',
      city: value.city ?? '',
      address: value.address ?? '',
      mapLink: value.mapLink ?? '',
      representativeName: value.locationRepresentativeName ?? '',
      phone: value.locationPhone ?? '',
    };

    this.savedLocations.update((items) => [...items, nextLocation]);
    this.clearLocationFields();
    this.syncPreview();
  }

  removeLocation(id: string): void {
    this.savedLocations.update((items) => items.filter((item) => item.id !== id));
    this.syncPreview();
  }

  private clearLocationFields(): void {
    this.profileForm.patchValue({
      locationNameEn: '',
      locationNameAr: '',
      country: 'Saudi Arabia',
      region: '',
      city: '',
      address: '',
      mapLink: '',
      locationRepresentativeName: '',
      locationPhone: '',
    });
  }
}
