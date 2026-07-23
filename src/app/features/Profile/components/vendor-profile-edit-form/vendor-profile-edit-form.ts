import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
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
  logo: string | null;
  cover: string | null;
}

/** Which image slot the crop dialog is currently editing. */
type CropTarget = 'logo' | 'coverMobile' | 'coverDesktop';

@Component({
  selector: 'app-vendor-profile-edit-form',
  imports: [CommonModule, ReactiveFormsModule, PrimeUIModules, VendorLocationDialog, TranslatePipe, ImageCropperComponent],
  templateUrl: './vendor-profile-edit-form.html',
  styleUrl: './vendor-profile-edit-form.css',
})
export class VendorProfileEditForm implements OnInit, OnDestroy {
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
    logo: null,
    cover: null,
  });
  readonly previewSocialLinks = signal<string[]>([]);
  readonly showLocationDialog = signal(false);
  readonly selectedLocationForEdit = signal<VendorProfileEditLocation | null>(null);
  readonly savedLocations = signal<VendorProfileEditLocation[]>([]);

  // ── Branding image previews (blob/object URLs shown in the form + live preview) ──
  readonly logoPreview = signal<string | null>(null);
  readonly coverMobilePreview = signal<string | null>(null);
  readonly coverDesktopPreview = signal<string | null>(null);
  readonly isLogoDragging = signal(false);
  readonly isCoverDragging = signal(false);

  // ── Image cropper (ngx-image-cropper in a dialog) ──
  readonly cropperVisible = signal(false);
  readonly cropperMounted = signal(true);
  readonly cropperImageUrl = signal('');
  readonly cropperTarget = signal<CropTarget>('logo');
  readonly cropperZoom = signal(1);
  private cropBlob: Blob | null = null;
  private pendingCropName = 'image';
  /** Original source object URLs kept so re-cropping doesn't need a re-upload. */
  private logoSource: string | null = null;
  private coverSource: string | null = null;
  /** After the mobile cover crop, chain straight into the desktop crop. */
  private chainToDesktopCrop = false;

  readonly cropperTransform = computed(() => ({
    scale: this.cropperZoom(),
    translateH: 0,
    translateV: 0,
    rotate: 0,
    flipH: false,
    flipV: false,
  }));

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
    logo: [null as string | File | null, Validators.required],
    coverMobile: [null as string | File | null, Validators.required],
    coverDesktop: [null as string | File | null, Validators.required],
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
      logo: data.logo ?? null,
      coverMobile: data.coverMobile ?? null,
      coverDesktop: data.coverDesktop ?? null,
    });
    // Seed previews for any images that arrive as ready-made URLs.
    if (typeof data.logo === 'string') this.logoPreview.set(data.logo);
    if (typeof data.coverMobile === 'string') this.coverMobilePreview.set(data.coverMobile);
    if (typeof data.coverDesktop === 'string') this.coverDesktopPreview.set(data.coverDesktop);
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
      logo: this.logoPreview(),
      cover: this.coverMobilePreview() ?? this.coverDesktopPreview(),
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
      logo: value.logo ?? null,
      coverMobile: value.coverMobile ?? null,
      coverDesktop: value.coverDesktop ?? null,
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

  // ── Branding: Vendor Logo ──────────────────────────────────────────────────

  onLogoDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isLogoDragging.set(true);
  }

  onLogoDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isLogoDragging.set(false);
  }

  onLogoDrop(event: DragEvent): void {
    event.preventDefault();
    this.isLogoDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.startLogoCrop(file);
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.startLogoCrop(file);
    input.value = '';
  }

  recropLogo(): void {
    if (!this.logoSource) return;
    this.chainToDesktopCrop = false;
    this.openCropper('logo', this.logoSource);
  }

  removeLogo(): void {
    this.revoke(this.logoPreview());
    this.logoPreview.set(null);
    this.revoke(this.logoSource);
    this.logoSource = null;
    this.setImage('logo', null);
  }

  private startLogoCrop(file: File): void {
    this.revoke(this.logoSource);
    this.logoSource = URL.createObjectURL(file);
    this.pendingCropName = file.name.replace(/\.[^.]+$/, '') || 'logo';
    this.chainToDesktopCrop = false;
    this.openCropper('logo', this.logoSource);
  }

  // ── Branding: Cover images (one source, cropped for mobile + desktop) ───────

  onCoverDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isCoverDragging.set(true);
  }

  onCoverDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isCoverDragging.set(false);
  }

  onCoverDrop(event: DragEvent): void {
    event.preventDefault();
    this.isCoverDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.startCoverCrop(file);
  }

  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.startCoverCrop(file);
    input.value = '';
  }

  recropCover(tab: 'mobile' | 'desktop'): void {
    if (!this.coverSource) return;
    this.chainToDesktopCrop = false;
    this.openCropper(tab === 'mobile' ? 'coverMobile' : 'coverDesktop', this.coverSource);
  }

  removeCover(tab: 'mobile' | 'desktop'): void {
    if (tab === 'mobile') {
      this.revoke(this.coverMobilePreview());
      this.coverMobilePreview.set(null);
      this.setImage('coverMobile', null);
    } else {
      this.revoke(this.coverDesktopPreview());
      this.coverDesktopPreview.set(null);
      this.setImage('coverDesktop', null);
    }
    if (!this.coverMobilePreview() && !this.coverDesktopPreview()) {
      this.revoke(this.coverSource);
      this.coverSource = null;
    }
  }

  private startCoverCrop(file: File): void {
    this.revoke(this.coverSource);
    this.coverSource = URL.createObjectURL(file);
    this.pendingCropName = file.name.replace(/\.[^.]+$/, '') || 'cover';
    this.chainToDesktopCrop = true;
    this.openCropper('coverMobile', this.coverSource);
  }

  // ── Image cropper dialog ───────────────────────────────────────────────────

  onImageCropped(event: ImageCroppedEvent): void {
    this.cropBlob = event.blob ?? null;
  }

  applyCrop(): void {
    if (!this.cropBlob) return;
    const target = this.cropperTarget();
    const file = new File([this.cropBlob], `${this.pendingCropName}-${target}.png`, { type: 'image/png' });
    const url = URL.createObjectURL(file);

    if (target === 'logo') {
      this.revoke(this.logoPreview());
      this.logoPreview.set(url);
      this.setImage('logo', file);
      this.closeCropper();
      return;
    }

    if (target === 'coverMobile') {
      this.revoke(this.coverMobilePreview());
      this.coverMobilePreview.set(url);
      this.setImage('coverMobile', file);
      // Fresh upload flow: after the mobile crop, chain into the desktop crop
      // of the same source so one upload yields both ratios.
      if (this.chainToDesktopCrop && this.coverSource) {
        this.chainToDesktopCrop = false;
        this.cropBlob = null;
        this.cropperZoom.set(1);
        this.cropperTarget.set('coverDesktop');
        this.cropperImageUrl.set(this.coverSource);
        this.refreshCropperInstance();
        return;
      }
      this.closeCropper();
      return;
    }

    // coverDesktop
    this.revoke(this.coverDesktopPreview());
    this.coverDesktopPreview.set(url);
    this.setImage('coverDesktop', file);
    this.closeCropper();
  }

  cancelCrop(): void {
    this.closeCropper();
  }

  zoomIn(): void {
    this.cropperZoom.set(Math.min(3, +(this.cropperZoom() + 0.1).toFixed(1)));
  }

  zoomOut(): void {
    this.cropperZoom.set(Math.max(0.2, +(this.cropperZoom() - 0.1).toFixed(1)));
  }

  get cropperAspectRatio(): number {
    switch (this.cropperTarget()) {
      case 'logo':
        return 1;
      case 'coverMobile':
        return 2.39 / 1;
      default:
        return 16 / 2;
    }
  }

  get cropperResizeWidth(): number {
    switch (this.cropperTarget()) {
      case 'logo':
        return 512;
      case 'coverMobile':
        return 1600;
      default:
        return 1920;
    }
  }

  get canApplyCrop(): boolean {
    return !!this.cropBlob;
  }

  /** On the mobile step of a fresh cover upload the primary button reads "Next". */
  get cropperOnMobileStep(): boolean {
    return this.cropperTarget() === 'coverMobile' && this.chainToDesktopCrop;
  }

  private openCropper(target: CropTarget, url: string): void {
    this.cropperTarget.set(target);
    this.cropBlob = null;
    this.cropperZoom.set(1);
    this.cropperImageUrl.set(url);
    this.refreshCropperInstance();
    this.cropperVisible.set(true);
  }

  private closeCropper(): void {
    this.cropperVisible.set(false);
    this.chainToDesktopCrop = false;
    this.cropBlob = null;
  }

  /** ngx-image-cropper caches its source/ratio; remount to pick up a new one. */
  private refreshCropperInstance(): void {
    this.cropperMounted.set(false);
    setTimeout(() => this.cropperMounted.set(true));
  }

  private setImage(control: CropTarget, value: File | null): void {
    const c = this.profileForm.get(control);
    c?.setValue(value);
    c?.markAsDirty();
    c?.updateValueAndValidity();
    this.profileForm.markAsDirty();
    this.syncPreview();
  }

  private revoke(url: string | null): void {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  ngOnDestroy(): void {
    [
      this.logoPreview(),
      this.coverMobilePreview(),
      this.coverDesktopPreview(),
      this.logoSource,
      this.coverSource,
    ].forEach((url) => this.revoke(url));
  }
}
