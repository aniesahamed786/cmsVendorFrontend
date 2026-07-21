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
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import {
  VendorProfileEditData,
  VendorProfileEditLocation,
} from '../../models/vendor-profile-edit.model';
import { VendorLocationDialog } from '../../../../shared/Components/vendor-location-dialog/vendor-location-dialog';

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
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules, VendorLocationDialog, TranslatePipe],
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
  languageFocus = output<'en' | 'ar'>();

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
  readonly showLocationDialog = signal(false);
  readonly selectedLocationForEdit = signal<VendorProfileEditLocation | null>(null);
  readonly savedLocations = signal<VendorProfileEditLocation[]>([]);

  readonly countryOptions = ['Saudi Arabia', 'United Arab Emirates', 'Bahrain', 'Kuwait', 'Oman', 'Qatar'];
  readonly regionOptions = ['Eastern Region', 'Riyadh Region', 'Makkah Region', 'Madinah Region', 'Qassim Region', 'Asir Region'];
  readonly cityOptions = ['Dammam', 'Khobar', 'Dhahran', 'Riyadh', 'Jeddah', 'Makkah', 'Medina'];

  profileForm = this.fb.group({
    nameEn: ['', Validators.required],
    nameAr: ['', Validators.required],
    crNumber: ['', Validators.required],
    descriptionEn: ['', Validators.required],
    descriptionAr: ['', Validators.required],
    businessPhone: ['', Validators.required],
    businessEmail: ['', [Validators.required, Validators.email]],
    businessWebsite: [''],
    repFullName: ['', Validators.required],
    repPhone: ['', Validators.required],
    repEmail: ['', [Validators.required, Validators.email]],
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

  onLocationSaved(newLoc: VendorProfileEditLocation): void {
    this.savedLocations.update(locs => {
      const idx = locs.findIndex(l => l.id === newLoc.id);
      if (idx !== -1) {
        const copy = [...locs];
        copy[idx] = newLoc;
        return copy;
      }
      return [...locs, newLoc];
    });
    this.syncLocationForm();
    this.syncPreview();
  }

  removeLocation(id: string): void {
    this.savedLocations.update(items => items.filter(item => item.id !== id));
    this.syncLocationForm();
    this.syncPreview();
  }
  
  private syncLocationForm(): void {
    // If the form required standard validation we would sync with a hidden control,
    // but the payload is built using this.savedLocations() anyway.
  }

  editLocation(loc: VendorProfileEditLocation): void {
    this.selectedLocationForEdit.set(loc);
    this.showLocationDialog.set(true);
  }

  openNewLocationDialog(): void {
    this.selectedLocationForEdit.set(null);
    this.showLocationDialog.set(true);
  }

  onFocusLanguage(lang: 'en' | 'ar'): void {
    this.languageFocus.emit(lang);
  }
}
