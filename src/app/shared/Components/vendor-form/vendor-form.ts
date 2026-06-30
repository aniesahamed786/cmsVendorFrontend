import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, effect, ElementRef, inject, Injector, input, OnDestroy, output, signal, ViewChild } from '@angular/core';
import {
  resolveAssetUrl,
  resolveMaskImageStyle,
  resolveUploadIconMaskStyle,
} from '../../utils/resolve-asset-url';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { CreateVendor, VendorSocialLink } from '../../../features/vendors/models/createNewVendor';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { VendorDetails } from '../../../features/vendors/models/vendordetails';
import { MapUrlCoordinatesService } from '../../../features/vendors/services/map-url-coordinates.service';
import { of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PrimeUIModules } from '../../../core/prime.import';
import { LocationCreationOffer } from '../location-creation-offer/location-creation-offer';
import { AddNewVendorLocationService, AddVendorLocationRequest } from '../../../features/vendors/services/add-new-vendor-location';
import { ConfirmationPopUp } from '../confirmation-pop-up/confirmation-pop-up';
import {
  clearFileInputValue,
} from '../../utils/file-upload-validation';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';

export function arabicOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    // Check for any English letters
    const englishRegex = /[a-zA-Z]/;
    return englishRegex.test(value) ? { arabicOnly: true } : null;
  };
}

export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;
    const isWhitespace = (value || '').trim().length === 0;
    return isWhitespace ? { whitespace: true } : null;
  };
}

type SocialLinkType = 'instagram' | 'whatsapp' | 'tiktok' | 'x' | 'snapchat' | 'linkedin' | 'facebook' | 'youtube' | 'other';
type CropperTarget = 'logo' | 'cover';

@Component({
  selector: 'app-vendor-form',
  imports: [ReactiveFormsModule, FormsModule, PrimeUIModules, LocationCreationOffer, ConfirmationPopUp, ImageCropperComponent],
  templateUrl: './vendor-form.html',
  styleUrl: './vendor-form.css',
})
export class VendorForm implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  submitFormEvent = output<CreateVendor>();
  actionType = input<string>('');
  buttonName = input<string>('Save');
  editableFormData = input<VendorDetails | null>(null);
  backNavRouteLink = input<string>('');
  vendorId = input<string | null>(null);
  isLoading = input<boolean>(false);
  vendorForm!: FormGroup;
  isDragging = signal(false);
  isDraggingCover = signal(false);
  addLocationDialogVisible = signal(false);
  editingLinkIndex = signal<number | null>(null);
  editingLocationIndex = signal<number | null>(null);
  editingLocationData = signal<AddVendorLocationRequest | null>(null);
  editingLinkValue = signal('');
  editingLinkAccountName = signal('');
  selectedSocialLinkType = signal<SocialLinkType | null>(null);
  readonly socialLinkTypes: Array<{ key: SocialLinkType; label: string }> = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'x', label: 'X' },
    { key: 'snapchat', label: 'Snapchat' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'other', label: 'Other' },
  ];
  selectedFile = signal<File | null>(null);
  selectedCoverFile = signal<File | null>(null);
  selectedCoverLandscapeFile = signal<File | null>(null);
  /** Object URL for preview when user uploads a new File (revoked on remove/destroy) */
  logoPreviewUrl = signal<string | null>(null);
  coverPreviewUrl = signal<string | null>(null);
  coverLandscapePreviewUrl = signal<string | null>(null);
  cropperVisible = signal(false);
  cropperImageUrl = signal('');
  cropperZoom = signal(1);
  cropperTarget = signal<CropperTarget>('logo');
  coverCropTab = signal<'mobile' | 'desktop'>('mobile');
  coverCropWorkflowMode = signal<'full' | 'single'>('single');
  croppedImageBlob: Blob | null = null;
  private cropperSourceObjectUrl: string | null = null;
  private pendingCropInput: HTMLInputElement | null = null;
  private pendingCropFileName = 'vendor-image';
  private coverCropSource: File | string | null = null;
  private coverCropMobileBlob: Blob | null = null;
  private coverCropDesktopBlob: Blob | null = null;
  private coverZoomByTab: Record<'mobile' | 'desktop', number> = { mobile: 1, desktop: 1 };
  /** Tracks which vendor was last patched into the form (edit mode). */
  private lastPatchedVendorId: string | null = null;
  readonly cropperTransform = computed(() => ({
    scale: this.cropperZoom(),
    translateH: 0,
    translateV: 0,
    rotate: 0,
    flipH: false,
    flipV: false,
  }));

  /** True when edit mode has user changes (including new image files). */
  hasEditChanges(): boolean {
    if (this.actionType() !== 'edit') {
      return true;
    }
    if (this.vendorForm.dirty) {
      return true;
    }
    const logo = this.vendorForm.get('logo')?.value;
    const cover = this.vendorForm.get('coverImage')?.value;
    const coverLandscape = this.vendorForm.get('coverImageLandscape')?.value;
    return logo instanceof File || cover instanceof File || coverLandscape instanceof File;
  }

  previewData = signal<any>(null);
  readonly showConfirmationDialog = signal(false);
  private pendingSubmitPayload: CreateVendor | null = null;
  readonly showDeleteLocationDialog = signal(false);
  readonly isDeletingLocation = signal(false);
  private pendingDeleteLocationIndex: number | null = null;
  readonly contactError = signal(false);
  readonly repContactError = signal(false);
  locationDeleted = output<void>();

  /** Preview URL to show when user has selected a new file (edit or create). Ensures we show new preview when form has File. */
  effectiveLogoPreviewUrl(): string | null {
    const logo = this.vendorForm.get('logo')?.value;
    if (logo instanceof File) {
      return this.logoPreviewUrl();
    }
    return null;
  }

  effectiveCoverPreviewUrl(): string | null {
    const cover = this.vendorForm.get('coverImage')?.value;
    if (cover instanceof File) {
      return this.coverPreviewUrl();
    }
    return null;
  }

  effectiveCoverLandscapePreviewUrl(): string | null {
    const cover = this.vendorForm.get('coverImageLandscape')?.value;
    if (cover instanceof File) {
      return this.coverLandscapePreviewUrl();
    }
    return null;
  }

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('coverFileInput') coverFileInputRef?: ElementRef<HTMLInputElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private messageService = inject(MessageService);
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private mapUrlCoordinatesService: MapUrlCoordinatesService,
    private vendorLocationService: AddNewVendorLocationService,
  ) {
    this.vendorForm = this.fb.group({
      nameEn: ['', [Validators.required, noWhitespaceValidator()]],
      nameAr: ['', [
        Validators.required,
        noWhitespaceValidator(),
        // arabicOnlyValidator(), // Arabic-only validation disabled
      ]],
      crNumber: [''],
      contact: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[0-9+() ]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      businessWebsite: ['', [Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/)]],
      descriptionEn: ['', [Validators.required, noWhitespaceValidator()]],
      descriptionAr: ['', [
        Validators.required,
        noWhitespaceValidator(),
        // arabicOnlyValidator(), // Arabic-only validation disabled
      ]],
      logo: [null, Validators.required],
      coverImage: [null, Validators.required],
      coverImageLandscape: [null, Validators.required],
      accountNameInput: [''],
      linkinput: ['', Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/)],
      socialLinks: this.fb.array<FormControl<VendorSocialLink | null>>([]),

      locations: this.fb.array([]),

      categories: this.fb.control([], {
        nonNullable: true,
      }),

      repFullName: ['', [Validators.required, noWhitespaceValidator()]],
      repContactNumber: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[0-9+() ]+$/)]],
      repEmail: ['', [Validators.required, Validators.email]],
    });

    // Initialize previewData with default values and update on change
    this.previewData.set(this.vendorForm.value);
    this.vendorForm.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => {
      this.previewData.set(val);
    });
  }

  ngOnInit(): void {
    const isEdit = this.actionType() === 'edit';
    if (isEdit) {
      this.vendorForm.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.vendorForm.markAsDirty());
    }

    effect(() => {
      const action = this.actionType();
      const data = this.editableFormData();
      if (action !== 'edit' || !data || Object.keys(data).length === 0) {
        return;
      }
      // Important: don't keep re-patching the form after the user starts editing,
      // otherwise we can accidentally flip the form back to pristine and disable "Save changes".
      const id =
        typeof (data as any)?._id === 'string'
          ? (data as any)._id
          : typeof (data as any)?._id?.$oid === 'string'
            ? (data as any)._id.$oid
            : null;
      const sameVendor = id != null && id === this.lastPatchedVendorId;
      if (sameVendor && this.hasEditChanges()) {
        return;
      }
      this.mapVendorToForm(data);
    }, { injector: this.injector });
  }

  // -----------------------
  // LINKS
  // -----------------------
  get socialLinks() {
    return this.vendorForm.get('socialLinks') as FormArray;
  }

  // -----------------------
  // CATEGORIES
  // -----------------------
  get categories() {
    return this.vendorForm.get('categories') as FormControl;
  }

  addLink() {
    const selectedType = this.selectedSocialLinkType();
    const value = this.vendorForm.get('linkinput')?.value;
    const accountNameValue = this.vendorForm.get('accountNameInput')?.value;
    if (!selectedType) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Select social media type',
        detail: 'Choose the social media platform before adding the link.',
        life: 3000,
      });
      return;
    }
    if (!value) return;
    this.socialLinks.push(new FormControl({
      url: value.trim(),
      ...(selectedType ? { platform: selectedType } : {}),
      ...(typeof accountNameValue === 'string' && accountNameValue.trim() ? { accountName: accountNameValue.trim() } : {}),
    }));
    this.vendorForm.get('accountNameInput')?.reset();
    this.vendorForm.get('linkinput')?.reset();
  }

  selectSocialLinkType(type: SocialLinkType): void {
    this.selectedSocialLinkType.update((currentType) => currentType === type ? null : type);
  }

  getSocialLinkPlaceholder(): string {
    const selectedType = this.selectedSocialLinkType();
    switch (selectedType) {
      case 'instagram':
        return 'Add Instagram link';
      case 'whatsapp':
        return 'Add WhatsApp link';
      case 'tiktok':
        return 'Add TikTok link';
      case 'x':
        return 'Add X link';
      case 'snapchat':
        return 'Add Snapchat link';
      case 'linkedin':
        return 'Add LinkedIn link';
      case 'facebook':
        return 'Add Facebook link';
      case 'youtube':
        return 'Add YouTube link';
      case 'other':
        return 'Add other social media link';
      default:
        return 'Select a social media type first';
    }
  }

  previewSocialLinks(): VendorSocialLink[] {
    const rawLinks = this.socialLinks.getRawValue();
    if (!Array.isArray(rawLinks)) {
      return [];
    }

    return rawLinks
      .map((value: unknown, index: number): VendorSocialLink | null => {
        const url = this.getSocialLinkUrl(value);
        if (!url) {
          return null;
        }

        const platform = this.getSocialLinkPlatform(value);
        const accountName = this.getSocialLinkAccountName(value);
        return {
          url,
          ...(platform ? { platform } : {}),
          ...(accountName ? { accountName } : {}),
        };
      })
      .filter((item: VendorSocialLink | null): item is VendorSocialLink => item !== null);
  }

  formatSocialLinkLabel(value: unknown): string {
    const accountName = this.getSocialLinkAccountName(value);
    if (accountName) {
      return accountName;
    }

    const trimmedValue = this.getSocialLinkUrl(value);
    if (!trimmedValue) {
      return '';
    }
    const withoutQuery = trimmedValue.split('?')[0];
    const normalizedValue = /^https?:\/\//i.test(withoutQuery) ? withoutQuery : `https://${withoutQuery}`;

    try {
      const url = new URL(normalizedValue);
      const path = url.pathname.replace(/^\/+|\/+$/g, '');
      const pathParts = path.split('/').filter(Boolean);
      const hostname = url.hostname.replace(/^www\./, '');

      if (hostname.includes('linkedin.com') && pathParts[0]?.toLowerCase() === 'in' && pathParts[1]) {
        return pathParts[1];
      }

      if (hostname.includes('tiktok.com')) {
        const username = pathParts.find(p => p.startsWith('@'));
        if (username) return username;
      }

      if (hostname.includes('snapchat.com') && pathParts[0]?.toLowerCase() === 'add' && pathParts[1]) {
        return pathParts[1];
      }

      return pathParts[pathParts.length - 1] || hostname;
    } catch {
      const fallbackParts = withoutQuery
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .filter(Boolean);

      return fallbackParts[fallbackParts.length - 1] || withoutQuery;
    }
  }

  getSocialLinkInputIconPath(): string | null {
    return this.resolveSocialIconPathFromType(this.selectedSocialLinkType());
  }

  getSocialTypeIconPath(type: SocialLinkType): string | null {
    return this.resolveSocialIconPathFromType(type);
  }

  getSocialLinkPlatformLabel(value: unknown): string {
    const platform = this.getSocialLinkPlatform(value);

    switch (platform) {
      case 'x':
        return 'X (Twitter)';
      case 'linkedin':
        return 'LinkedIn';
      case 'tiktok':
        return 'TikTok';
      case 'youtube':
        return 'YouTube';
      case 'whatsapp':
        return 'WhatsApp';
      case 'facebook':
        return 'Facebook';
      case 'snapchat':
        return 'Snapchat';
      case 'instagram':
        return 'Instagram';
      case 'other':
        return 'social media';
      default:
        return 'social media';
    }
  }

  getSocialLinkAccountHelper(value: unknown): string {
    return `This is your ${this.getSocialLinkPlatformLabel(value)} username`;
  }

  getSocialLinkUrlHelper(value: unknown): string {
    return `Add the link to your ${this.getSocialLinkPlatformLabel(value)} profile`;
  }

  getSocialLinkIconPath(value: unknown, index?: number): string | null {
    const explicitType = this.getSocialLinkPlatform(value);
    if (explicitType) {
      return this.resolveSocialIconPathFromType(explicitType);
    }

    return null;
  }

  getSocialLinkIconClass(value: unknown, index?: number): string {
    const linkType = this.getSocialLinkPlatform(value);
    if (linkType !== 'linkedin') {
      return 'vendor-form-social-icon';
    }

    return 'vendor-form-social-icon vendor-form-social-icon--linkedin';
  }

  private getSocialLinkUrl(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value && typeof value === 'object' && typeof (value as VendorSocialLink).url === 'string') {
      return (value as VendorSocialLink).url.trim();
    }

    return '';
  }

  private getSocialLinkPlatform(value: unknown): SocialLinkType | null {
    if (value && typeof value === 'object') {
      const socialLink = value as VendorSocialLink & Record<string, unknown>;
      const typeValue = socialLink['type'];
      const platformTypeValue = socialLink['platformType'];
      const socialMediaTypeValue = socialLink['socialMediaType'];
      const candidatePlatform =
        typeof socialLink.platform === 'string' ? socialLink.platform :
        typeof typeValue === 'string' ? typeValue :
        typeof platformTypeValue === 'string' ? platformTypeValue :
        typeof socialMediaTypeValue === 'string' ? socialMediaTypeValue :
        '';

      return this.normalizeSocialLinkType(candidatePlatform.trim().toLowerCase());
    }

    return null;
  }

  private getSocialLinkAccountName(value: unknown): string {
    if (value && typeof value === 'object' && typeof (value as VendorSocialLink).accountName === 'string') {
      return (value as VendorSocialLink).accountName!.trim();
    }

    return '';
  }

  private resolveSocialIconPathFromType(type: SocialLinkType | null): string | null {
    switch (type) {
      case 'instagram':
        return this.resolveSocialAsset('ic-instagram.svg');
      case 'linkedin':
        return this.resolveSocialAsset('linkedin.svg');
      case 'facebook':
        return this.resolveSocialAsset('ic-facebook.svg');
      case 'tiktok':
        return this.resolveSocialAsset('tiktok.svg');
      case 'youtube':
        return this.resolveSocialAsset('youtube.svg');
      case 'snapchat':
        return this.resolveSocialAsset('ic-snapchat.svg');
      case 'whatsapp':
        return this.resolveSocialAsset('whatspp.svg');
      case 'x':
        return this.resolveSocialAsset('X.svg');
      default:
        return null;
    }
  }

  private normalizeSocialLinkType(value: string): SocialLinkType | null {
    switch (value) {
      case 'instagram':
      case 'whatsapp':
      case 'tiktok':
      case 'x':
      case 'snapchat':
      case 'linkedin':
      case 'facebook':
      case 'youtube':
      case 'other':
        return value;
      case 'twitter':
        return 'x';
      default:
        return null;
    }
  }

  removeLink(index: number) {
    this.socialLinks.removeAt(index);
    if (this.editingLinkIndex() === index) {
      this.cancelEditLink();
    }
  }

  editLink(index: number) {
    const value = this.socialLinks.at(index)?.value;
    this.editingLinkIndex.set(index);
    this.editingLinkValue.set(this.getSocialLinkUrl(value));
    this.editingLinkAccountName.set(this.getSocialLinkAccountName(value));
  }

  updateEditingLinkValue(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingLinkValue.set(input.value);
  }

  updateEditingLinkAccountName(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editingLinkAccountName.set(input.value);
  }

  saveEditLink(index: number) {
    const value = this.editingLinkValue().trim();
    if (!value) return;

    const existingValue = this.socialLinks.at(index)?.value;
    const platform = this.getSocialLinkPlatform(existingValue) || 'other';
    const accountName = this.editingLinkAccountName().trim();

    this.socialLinks.at(index)?.setValue({
      url: value,
      ...(platform ? { platform } : {}),
      ...(accountName ? { accountName } : {}),
    });
    this.cancelEditLink();
  }

  cancelEditLink() {
    this.editingLinkIndex.set(null);
    this.editingLinkValue.set('');
    this.editingLinkAccountName.set('');
  }

  // -----------------------
  // LOCATIONS
  // -----------------------
  get locations() {
    return this.vendorForm.get('locations') as FormArray;
  }

  createLocationGroup() {
    const locationGroup = this.fb.group({
      id: [''],
      branchName: ['', Validators.required],
      branchNameAr: ['', Validators.required],
      country: ['Saudi Arabia', Validators.required],
      country_ar: [''],
      region: ['', Validators.required],
      region_ar: [''],
      city: ['', Validators.required],
      city_ar: [''],
      address: ['', Validators.required],
      googleMapLink: ['', Validators.required],
      representativeName: ['', Validators.required],
      phoneNumber: ['', Validators.required],
      latitude: [null as number | null],
      longitude: [null as number | null]
    });

    this.setupMapLinkSubscription(locationGroup);
    return locationGroup;
  }

  private setupMapLinkSubscription(locationGroup: FormGroup): void {
    locationGroup.get('googleMapLink')?.valueChanges.pipe(
      debounceTime(500),
      switchMap((url: string | null) => {
        if (!url || !url.trim()) {
          locationGroup.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
          locationGroup.get('googleMapLink')?.setErrors(null);
          return of(null);
        }
        return this.mapUrlCoordinatesService.getCoordinatesFromMapUrl(url).pipe(
          catchError(() => {
            locationGroup.get('googleMapLink')?.setErrors({ invalidMapLink: true });
            locationGroup.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(coords => {
      if (coords) {
        locationGroup.patchValue(
          { latitude: coords.latitude, longitude: coords.longitude },
          { emitEvent: false }
        );
        locationGroup.get('googleMapLink')?.setErrors(null);
      }
    });
  }

  addLocation() {
    this.locations.push(this.createLocationGroup());
    // Adding/removing FormArray items doesn't always flip the parent dirty flag
    // (depending on Angular version/change detection timing), but edit mode relies on it.
    this.vendorForm.markAsDirty();
  }

  removeLocation(index: number) {
    const location = this.locations.at(index)?.value;
    const locationId = this.normalizeId(location?.id);

    if (this.actionType() === 'edit' && locationId && this.vendorId()) {
      this.pendingDeleteLocationIndex = index;
      this.showDeleteLocationDialog.set(true);
      return;
    }

    this.locations.removeAt(index);
    this.vendorForm.markAsDirty();
  }

  cancelDeleteLocation(): void {
    if (this.isDeletingLocation()) return;
    this.showDeleteLocationDialog.set(false);
    this.pendingDeleteLocationIndex = null;
  }

  isDeletePendingForIndex(index: number): boolean {
    return this.isDeletingLocation() && this.pendingDeleteLocationIndex === index;
  }

  confirmDeleteLocation(): void {
    const index = this.pendingDeleteLocationIndex;
    const vendorId = this.vendorId();
    const location = index !== null ? this.locations.at(index)?.value : null;
    const locationId = this.normalizeId(location?.id);

    if (index === null || !vendorId || !locationId || this.isDeletingLocation()) {
      return;
    }

    this.isDeletingLocation.set(true);
    this.vendorLocationService.deleteLocation(vendorId, locationId).subscribe({
      next: () => {
        this.locations.removeAt(index);
        this.vendorForm.markAsDirty();
        this.showDeleteLocationDialog.set(false);
        this.pendingDeleteLocationIndex = null;
        this.isDeletingLocation.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Branch deleted',
          detail: 'Branch deleted successfully. Linked offers were updated automatically.',
          life: 3000,
        });
        this.locationDeleted.emit();
      },
      error: (err) => {
        this.isDeletingLocation.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: this.getDeleteLocationErrorMessage(err),
          life: 3500,
        });
      },
    });
  }

  getDeleteLocationDialogMessage(): string {
    const location = this.pendingDeleteLocation();
    if (!location) return '';

    const lines = [
      'Deleting this branch will remove it from the vendor and update any linked offers automatically.',
    ];

    const offerCount = this.getLocationOffersCount(location);
    if (offerCount > 0) {
      lines.push(
        `This branch is linked to ${offerCount} offer(s). Offers linked to other branches will keep those branches. Offers that lose their last assigned branch will become inactive.`,
      );
    }

    if (this.isDeletingLastLocation()) {
      lines.push(
        'This is the vendor’s last branch. Any linked offers that depend on this branch may become inactive after deletion.',
      );
    }

    return lines.join('\n\n');
  }

  onLocationAdded() {
    this.addLocationDialogVisible.set(false);
    // In edit mode, we might want to refresh the entire vendor details,
    // but usually the list will be updated by the parent.
  }

  openAddLocationDialog() {
    this.editingLocationIndex.set(null);
    this.editingLocationData.set(null);
    this.addLocationDialogVisible.set(true);
  }

  editLocation(index: number) {
    this.editingLocationIndex.set(index);
    this.editingLocationData.set(this.getEditingLocationData());
    this.addLocationDialogVisible.set(true);
  }

  getEditingLocationData(): AddVendorLocationRequest | null {
    const index = this.editingLocationIndex();
    if (index === null) return null;

    const group = this.locations.at(index) as FormGroup;
    const val = group.value;
    return {
      id: val.id ?? '',
      branch_name: val.branchName,
      branch_name_ar: val.branchNameAr,
      country: val.country,
      country_ar: val.country_ar ?? '',
      region: val.region,
      region_ar: val.region_ar ?? '',
      city: val.city,
      city_ar: val.city_ar ?? '',
      address: val.address,
      link: val.googleMapLink,
      branchRepresentativeName: val.representativeName,
      branchPhoneNumber: val.phoneNumber,
      latitude: val.latitude,
      longitude: val.longitude,
      geohash: ''
    };
  }

  handleAddLocation(payload: AddVendorLocationRequest) {
    const index = this.editingLocationIndex();

    const locationData = {
      id: payload.id ?? '',
      branchName: payload.branch_name ?? '',
      branchNameAr: payload.branch_name_ar ?? '',
      country: payload.country ?? '',
      country_ar: payload.country_ar ?? '',
      region: payload.region ?? '',
      region_ar: payload.region_ar ?? '',
      city: payload.city ?? '',
      city_ar: payload.city_ar ?? '',
      address: payload.address ?? '',
      googleMapLink: payload.link ?? '',
      representativeName: payload.branchRepresentativeName ?? '',
      phoneNumber: payload.branchPhoneNumber ?? '',
      latitude: payload.latitude ?? null as number | null,
      longitude: payload.longitude ?? null as number | null,
      offersCount: 0,
    };

    if (index !== null) {
      // Update existing
      const group = this.locations.at(index) as FormGroup;
      group.patchValue(locationData);
    } else {
      // Add new
      const locationGroup = this.fb.group(locationData);
      // Re-apply validators since fb.group with raw object might skip them if not careful
      // but here we just need consistency.
      this.setupMapLinkSubscription(locationGroup);
      this.locations.push(locationGroup);
    }

    this.editingLocationIndex.set(null);
    this.editingLocationData.set(null);
    this.vendorForm.markAsDirty();
  }

  // -----------------------
  // FILE UPLOAD
  // -----------------------


  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleLogoFile(files[0]);
    }
  }

  onFileSelected(event: any) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleLogoFile(file, input);
    }
  }

  onCoverDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDraggingCover.set(true);
  }

  onCoverDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDraggingCover.set(false);
  }

  onCoverDrop(event: DragEvent) {
    event.preventDefault();
    this.isDraggingCover.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleCoverFile(files[0]);
    }
  }

  onCoverFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleCoverFile(file, input);
    }
  }

  private validateImageFile(file: File, input?: HTMLInputElement | null): boolean {
    if (file.size > 10 * 1024 * 1024) {
      this.messageService.add({
        severity: 'error',
        summary: 'File too large',
        detail: 'Maximum allowed size is 10MB'
      });
      clearFileInputValue(input ?? undefined);
      return false;
    }
    return true;
  }

  handleLogoFile(file: File, input?: HTMLInputElement | null) {
    if (!this.validateImageFile(file, input ?? this.fileInputRef?.nativeElement)) return;
    this.openCropper('logo', file, input ?? this.fileInputRef?.nativeElement ?? null);
  }

  handleCoverFile(file: File, input?: HTMLInputElement | null) {
    if (!this.validateImageFile(file, input ?? this.coverFileInputRef?.nativeElement)) return;
    this.openCropper('cover', file, input ?? this.coverFileInputRef?.nativeElement ?? null);
  }

  removeLogo(): void {
    this.cancelCrop(false);
    const url = this.logoPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.logoPreviewUrl.set(null);
    this.selectedFile.set(null);
    this.vendorForm.patchValue({ logo: null });
    this.vendorForm.get('logo')?.markAsDirty();
    this.vendorForm.get('logo')?.updateValueAndValidity();
    this.vendorForm.markAsDirty();
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  removeCoverImage(): void {
    const url = this.coverPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.coverPreviewUrl.set(null);
    this.selectedCoverFile.set(null);
    this.vendorForm.patchValue({ coverImage: null });
    this.vendorForm.get('coverImage')?.markAsDirty();
    this.vendorForm.get('coverImage')?.updateValueAndValidity();
    this.vendorForm.markAsDirty();
    if (this.coverFileInputRef?.nativeElement) {
      this.coverFileInputRef.nativeElement.value = '';
    }
  }

  removeCoverLandscapeImage(): void {
    const url = this.coverLandscapePreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.coverLandscapePreviewUrl.set(null);
    this.selectedCoverLandscapeFile.set(null);
    this.vendorForm.patchValue({ coverImageLandscape: null });
    this.vendorForm.get('coverImageLandscape')?.markAsDirty();
    this.vendorForm.get('coverImageLandscape')?.updateValueAndValidity();
    this.vendorForm.markAsDirty();
  }

  private openCropper(target: CropperTarget, source: File | string, input: HTMLInputElement | null): void {
    this.resetCropperSourceObjectUrl();
    this.cropperTarget.set(target);
    this.pendingCropInput = input;
    this.croppedImageBlob = null;
    this.cropperZoom.set(1);

    if (target === 'cover') {
      this.coverCropSource = source;
      this.coverCropMobileBlob = null;
      this.coverCropDesktopBlob = null;
      this.coverZoomByTab = { mobile: 1, desktop: 1 };
      this.coverCropTab.set('mobile');
      this.coverCropWorkflowMode.set(source instanceof File ? 'full' : 'single');
    }

    if (source instanceof File) {
      this.pendingCropFileName = source.name.replace(/\.[^.]+$/, '') || `vendor-${target}`;
      this.cropperSourceObjectUrl = URL.createObjectURL(source);
      this.cropperImageUrl.set(this.cropperSourceObjectUrl);
    } else {
      this.pendingCropFileName = `vendor-${target}`;
      this.cropperImageUrl.set(source);
    }

    this.cropperVisible.set(true);
  }

  recropLogo(): void {
    const currentFile = this.selectedFile();
    if (currentFile) {
      this.openCropper('logo', currentFile, this.fileInputRef?.nativeElement ?? null);
      return;
    }

    const currentLogo = this.vendorForm.get('logo')?.value;
    if (typeof currentLogo === 'string' && currentLogo.trim()) {
      this.openCropper('logo', currentLogo, this.fileInputRef?.nativeElement ?? null);
    }
  }

  recropCover(tab: 'mobile' | 'desktop' = 'mobile'): void {
    const source = this.resolveCoverCropSource(tab);
    if (!source) return;

    this.openCropper('cover', source, this.coverFileInputRef?.nativeElement ?? null);
    this.coverCropWorkflowMode.set('single');
    if (tab === 'desktop') {
      this.switchCoverCropTab('desktop');
    }
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (this.cropperTarget() === 'cover') {
      if (this.coverCropTab() === 'mobile') {
        this.coverCropMobileBlob = event.blob ?? null;
      } else {
        this.coverCropDesktopBlob = event.blob ?? null;
      }
      return;
    }
    this.croppedImageBlob = event.blob ?? null;
  }

  zoomIn(): void {
    const current = this.cropperZoom();
    if (current < 3) {
      this.cropperZoom.set(Math.min(3, +(current + 0.1).toFixed(1)));
    }
  }

  zoomOut(): void {
    const current = this.cropperZoom();
    if (current > 0.1) {
      this.cropperZoom.set(Math.max(0.1, +(current - 0.1).toFixed(1)));
    }
  }

  onZoomSlider(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.cropperZoom.set(value);
    if (this.cropperTarget() === 'cover') {
      this.coverZoomByTab[this.coverCropTab()] = value;
    }
  }

  get cropperAspectRatio(): number {
    if (this.cropperTarget() === 'logo') return 1;
    return this.coverCropTab() === 'mobile' ? 2.39 / 1 : 16 / 2;
  }

  get cropperResizeWidth(): number {
    if (this.cropperTarget() === 'logo') return 512;
    return this.coverCropTab() === 'mobile' ? 1600 : 1920;
  }

  applyCrop(): void {
    const target = this.cropperTarget();

    if (target === 'logo') {
      if (!this.croppedImageBlob) return;
      const file = new File([this.croppedImageBlob], `${this.pendingCropFileName}-cropped.png`, { type: 'image/png' });
      const previewUrl = URL.createObjectURL(file);
      const oldUrl = this.logoPreviewUrl();
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      this.logoPreviewUrl.set(previewUrl);
      this.selectedFile.set(file);
      this.vendorForm.patchValue({ logo: file });
      this.vendorForm.get('logo')?.markAsDirty();
      this.vendorForm.get('logo')?.updateValueAndValidity();
    } else {
      if (this.isCoverSequentialFlow() && this.coverCropTab() === 'mobile') {
        if (!this.coverCropMobileBlob) return;
        this.switchCoverCropTab('desktop');
        return;
      }

      if (!this.hasCoverCropResult('mobile') || !this.hasCoverCropResult('desktop')) return;

      const mobileFile = this.coverCropMobileBlob
        ? new File([this.coverCropMobileBlob], `${this.pendingCropFileName}-mobile-cropped.png`, { type: 'image/png' })
        : null;
      const desktopFile = this.coverCropDesktopBlob
        ? new File([this.coverCropDesktopBlob], `${this.pendingCropFileName}-desktop-cropped.png`, { type: 'image/png' })
        : null;

      if (mobileFile) {
        const previewUrl = URL.createObjectURL(mobileFile);
        const oldUrl = this.coverPreviewUrl();
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        this.coverPreviewUrl.set(previewUrl);
        this.selectedCoverFile.set(mobileFile);
        this.vendorForm.patchValue({ coverImage: mobileFile });
        this.vendorForm.get('coverImage')?.markAsDirty();
        this.vendorForm.get('coverImage')?.updateValueAndValidity();
      }

      if (desktopFile) {
        const previewUrl = URL.createObjectURL(desktopFile);
        const oldUrl = this.coverLandscapePreviewUrl();
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        this.coverLandscapePreviewUrl.set(previewUrl);
        this.selectedCoverLandscapeFile.set(desktopFile);
        this.vendorForm.patchValue({ coverImageLandscape: desktopFile });
        this.vendorForm.get('coverImageLandscape')?.markAsDirty();
        this.vendorForm.get('coverImageLandscape')?.updateValueAndValidity();
      }
    }

    this.vendorForm.markAsDirty();
    this.cancelCrop(false);
  }

  cancelCrop(clearInput = true): void {
    if (clearInput) {
      clearFileInputValue(this.pendingCropInput ?? undefined);
    }
    this.cropperVisible.set(false);
    this.cropperImageUrl.set('');
    this.cropperZoom.set(1);
    this.croppedImageBlob = null;
    this.coverCropMobileBlob = null;
    this.coverCropDesktopBlob = null;
    this.coverZoomByTab = { mobile: 1, desktop: 1 };
    this.coverCropWorkflowMode.set('single');
    this.coverCropSource = null;
    this.pendingCropInput = null;
    this.pendingCropFileName = 'vendor-image';
    this.resetCropperSourceObjectUrl();
  }

  isCoverSequentialFlow(): boolean {
    return this.cropperTarget() === 'cover' && this.coverCropWorkflowMode() === 'full';
  }

  get canOpenDesktopCoverTab(): boolean {
    if (!this.isCoverSequentialFlow()) {
      return true;
    }
    return this.coverCropTab() === 'desktop' || !!this.coverCropMobileBlob;
  }

  get cropperPrimaryActionLabel(): string {
    if (this.isCoverSequentialFlow() && this.coverCropTab() === 'mobile') {
      return 'Next';
    }
    return 'Apply Crop';
  }

  get cropperPrimaryActionIcon(): string {
    if (this.isCoverSequentialFlow() && this.coverCropTab() === 'mobile') {
      return '';
    }
    return 'pi pi-check';
  }

  get canApplyCrop(): boolean {
    if (this.cropperTarget() === 'logo') {
      return !!this.croppedImageBlob;
    }
    if (this.isCoverSequentialFlow() && this.coverCropTab() === 'mobile') {
      return !!this.coverCropMobileBlob;
    }
    return this.hasCoverCropResult('mobile') && this.hasCoverCropResult('desktop');
  }

  switchCoverCropTab(tab: 'mobile' | 'desktop'): void {
    if (this.cropperTarget() !== 'cover' || this.coverCropTab() === tab) {
      return;
    }
    if (tab === 'desktop' && !this.canOpenDesktopCoverTab) {
      return;
    }

    this.coverZoomByTab[this.coverCropTab()] = this.cropperZoom();
    this.coverCropTab.set(tab);
    this.cropperZoom.set(this.coverZoomByTab[tab]);

    if (!this.isCoverSequentialFlow()) {
      const source = this.resolveCoverCropSource(tab);
      if (source) {
        this.resetCropperSourceObjectUrl();
        if (source instanceof File) {
          this.pendingCropFileName = source.name.replace(/\.[^.]+$/, '') || 'vendor-cover';
          this.cropperSourceObjectUrl = URL.createObjectURL(source);
          this.cropperImageUrl.set(this.cropperSourceObjectUrl);
        } else {
          this.pendingCropFileName = 'vendor-cover';
          this.cropperImageUrl.set(source);
        }
      }
    }
  }

  private hasCoverCropResult(tab: 'mobile' | 'desktop'): boolean {
    const pendingBlob = tab === 'mobile' ? this.coverCropMobileBlob : this.coverCropDesktopBlob;
    if (pendingBlob) return true;
    const controlName = tab === 'mobile' ? 'coverImage' : 'coverImageLandscape';
    const value = this.vendorForm.get(controlName)?.value;
    return value instanceof File || (typeof value === 'string' && value.trim().length > 0);
  }

  private resolveCoverCropSource(tab: 'mobile' | 'desktop'): File | string | null {
    const preferredControl = tab === 'mobile' ? 'coverImage' : 'coverImageLandscape';
    const secondaryControl = tab === 'mobile' ? 'coverImageLandscape' : 'coverImage';
    const preferredValue = this.vendorForm.get(preferredControl)?.value;
    const secondaryValue = this.vendorForm.get(secondaryControl)?.value;

    if (preferredValue instanceof File) return preferredValue;
    if (typeof preferredValue === 'string' && preferredValue.trim()) return preferredValue;
    if (secondaryValue instanceof File) return secondaryValue;
    if (typeof secondaryValue === 'string' && secondaryValue.trim()) return secondaryValue;
    if (this.coverCropSource) return this.coverCropSource;
    return null;
  }

  private resetCropperSourceObjectUrl(): void {
    if (this.cropperSourceObjectUrl) {
      URL.revokeObjectURL(this.cropperSourceObjectUrl);
      this.cropperSourceObjectUrl = null;
    }
  }


  /** Validation order: first missing in this sequence gets the toast. Paths for form.get(path). */
  private getValidationOrder(): Array<{ path: string; label: string }> {
    const top: Array<{ path: string; label: string }> = [
      { path: 'nameEn', label: 'Vendor Name (English)' },
      { path: 'nameAr', label: 'Vendor Name (Arabic)' },
      { path: 'contact', label: 'Contact Number' },
      { path: 'email', label: 'Email' },
      { path: 'descriptionEn', label: 'Description (English)' },
      { path: 'descriptionAr', label: 'Description (Arabic)' },
      { path: 'logo', label: 'Vendor Logo' },
      { path: 'coverImage', label: 'Cover Image (Mobile)' },
      { path: 'coverImageLandscape', label: 'Cover Image (Desktop)' },
    ];
    const rep: Array<{ path: string; label: string }> = [
      { path: 'repFullName', label: 'Representative Full Name' },
      { path: 'repContactNumber', label: 'Representative Contact Number' },
      { path: 'repEmail', label: 'Representative Email' },
    ];
    return [...top, ...rep];
  }

  /** Returns the first invalid field in validation order, or null if valid. */
  private getFirstMissingInOrder(): { control: FormControl; label: string } | null {
    for (const { path, label } of this.getValidationOrder()) {
      const control = this.vendorForm.get(path);
      if (control && control.invalid && control.errors) {
        return { control: control as FormControl, label };
      }
    }
    return null;
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.vendorForm.get(controlName);
    return !!control?.touched && (control.hasError('required') || control.hasError('whitespace'));
  }

  hasFieldError(controlName: string, errorName: string): boolean {
    const control = this.vendorForm.get(controlName);
    return !!control?.touched && !control.hasError('required') && control.hasError(errorName);
  }

  sanitizeNumericInput(controlName: 'contact' | 'repContactNumber') {
    const control = this.vendorForm.get(controlName);
    const currentValue = control?.value;

    if (typeof currentValue !== 'string') {
      return;
    }

    const sanitizedValue = currentValue.replace(/[^0-9+() ]/g, '');
    if (sanitizedValue !== currentValue) {
      control?.setValue(sanitizedValue);
      if (controlName === 'contact') this.contactError.set(true);
      else this.repContactError.set(true);
    } else {
      if (controlName === 'contact') this.contactError.set(false);
      else this.repContactError.set(false);
    }
  }

  sanitizeArabicInput(controlName: string) {
    // Arabic-only input sanitizing disabled.
    return;
  }

  submitForm() {
    if (this.actionType() === 'edit' && !this.hasEditChanges()) {
      this.messageService.add({
        severity: 'info',
        summary: 'No changes made',
        detail: 'Please update at least one field before saving.',
        life: 2500,
      });
      return;
    }

    if (this.vendorForm.invalid) {
      const first = this.getFirstMissingInOrder();
      if (first) {
        first.control.markAsTouched();
        first.control.markAsDirty();
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing required field',
          detail: `Please fill in: ${first.label}.`,
          life: 5000,
        });
      } else {
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing required fields',
          detail: 'Please fill in all required fields.',
          life: 5000,
        });
        this.markFormGroupTouched(this.vendorForm);
      }
      return;
    }

    this.pendingSubmitPayload = this.mapFormToVendor(this.vendorForm.value);
    this.showConfirmationDialog.set(true);
  }

  onConfirmSubmit(): void {
    if (this.isLoading()) return;

    this.showConfirmationDialog.set(false);
    const payload = this.pendingSubmitPayload;
    this.pendingSubmitPayload = null;
    if (payload) {
      this.submitFormEvent.emit(payload);
    }
  }

  onCancelSubmit(): void {
    this.showConfirmationDialog.set(false);
    this.pendingSubmitPayload = null;
  }

  mapFormToVendor(form: any): CreateVendor {
    const website = form.businessWebsite ? [form.businessWebsite] : [];
    const socialLinks = Array.isArray(form.socialLinks)
      ? form.socialLinks
          .map((item: unknown): VendorSocialLink | null => {
            const url = this.getSocialLinkUrl(item);
            if (!url) {
              return null;
            }

            const platform = this.getSocialLinkPlatform(item);
            const accountName = this.getSocialLinkAccountName(item);
            return {
              url,
              ...(platform ? { platform } : {}),
              ...(accountName ? { accountName } : {}),
            };
          })
          .filter((item: VendorSocialLink | null): item is VendorSocialLink => item !== null)
      : [];
    const isEdit = this.actionType() === 'edit';

    return {
      name: form.nameEn,
      name_ar: form.nameAr,
      description: form.descriptionEn,
      description_ar: form.descriptionAr,

      website,
      crn_no: form.crNumber,

      email: form.email ? [form.email] : [],
      mobile: form.contact ? [form.contact] : [],
      telephone: [],

      socialLinks,

      locations: (form.locations || []).map((loc: any) => ({
        id: loc.id || undefined,
        branch_name: loc.branchName || '',
        branch_name_ar: loc.branchNameAr || '',
        country: loc.country || '',
        country_ar: loc.country_ar || '',
        region: loc.region || '',
        region_ar: loc.region_ar || '',
        city: loc.city || '',
        city_ar: loc.city_ar || '',
        link: loc.googleMapLink || '',
        latitude: loc.latitude ?? null,
        longitude: loc.longitude ?? null,
        address: loc.address || '',
        branchRepresentativeName: loc.representativeName || '',
        branchPhoneNumber: loc.phoneNumber || ''
      })),

      searchKeywords: [],

      smeName: form.repFullName,
      smeEmail: form.repEmail,
      smePhone: form.repContactNumber,

      // Avoid sending legacy status updates during edit; new vendors should start enabled and become idle until offers are active.
      isActive: isEdit ? undefined : true,

      logo: form.logo ?? null,
      coverImage: form.coverImage ?? null,
      coverImageLandscape: form.coverImageLandscape ?? null,

      categories: Array.isArray(form.categories) ? form.categories : (form.categories ? [form.categories] : [])
    };
  }

  mapVendorToForm(data: any) {
    if (!data || typeof data !== 'object') {
      return;
    }
    console.log('mapVendorToForm called with data:', data);

    // Handle mobile - can be string or string[]
    const mobileValue = Array.isArray(data.mobile) ? data.mobile[0] : (typeof data.mobile === 'string' ? data.mobile : '');

    // Handle email - can be string or string[]
    const emailValue = Array.isArray(data.email) ? data.email[0] : (typeof data.email === 'string' ? data.email : '');

    // Business website - separate from social/media links.
    const websiteValue = Array.isArray(data.website)
      ? data.website[0]
      : (typeof data.website === 'string' ? data.website : '');

    // Commercial Registration: support both snake_case (API) and camelCase
    const crNumber = data.crn_no ?? data.crnNo ?? '';

    // Logo: may be URL string in edit mode or File when uploading.
    // If user has already selected a new file (logo is File), do not overwrite it when
    // this mapping runs again (e.g. effect re-run), so the new preview is preserved.
    const currentLogo = this.vendorForm.get('logo')?.value;
    const logoValue = data.logo != null ? data.logo : null;
    const userSelectedNewFile = currentLogo instanceof File;
    if (!userSelectedNewFile) {
      if (typeof logoValue === 'string') {
        const prev = this.logoPreviewUrl();
        if (prev) URL.revokeObjectURL(prev);
        this.logoPreviewUrl.set(null);
        this.selectedFile.set(null);
      }
    }

    const currentCover = this.vendorForm.get('coverImage')?.value;
    const coverValue = data.coverImage != null ? data.coverImage : null;
    const userSelectedNewCoverFile = currentCover instanceof File;
    if (!userSelectedNewCoverFile) {
      if (typeof coverValue === 'string') {
        const prev = this.coverPreviewUrl();
        if (prev) URL.revokeObjectURL(prev);
        this.coverPreviewUrl.set(null);
        this.selectedCoverFile.set(null);
      }
    }

    const currentCoverLandscape = this.vendorForm.get('coverImageLandscape')?.value;
    const coverLandscapeValue =
      data.coverImageLandscape ?? data['vendor-cover-landscape'] ?? data.vendorCoverLandscape ?? null;
    const userSelectedNewCoverLandscapeFile = currentCoverLandscape instanceof File;
    if (!userSelectedNewCoverLandscapeFile) {
      if (typeof coverLandscapeValue === 'string') {
        const prev = this.coverLandscapePreviewUrl();
        if (prev) URL.revokeObjectURL(prev);
        this.coverLandscapePreviewUrl.set(null);
        this.selectedCoverLandscapeFile.set(null);
      }
    }

    const formPatch: Record<string, unknown> = {
      nameEn: data.name || '',
      nameAr: data.name_ar || '',
      crNumber,
      contact: mobileValue || '',
      email: emailValue || '',
      businessWebsite: websiteValue || '',
      descriptionEn: data.description || '',
      descriptionAr: data.description_ar || '',
      accountNameInput: '',
      linkinput: '',
      categories: Array.isArray(data.categories) ? data.categories : (data.category ? [data.category] : []),
      repFullName: data.smeName || '',
      repContactNumber: data.smePhone || '',
      repEmail: data.smeEmail || ''
    };
    if (!userSelectedNewFile) {
      formPatch['logo'] = logoValue;
    }
    if (!userSelectedNewCoverFile) {
      formPatch['coverImage'] = coverValue;
    }
    if (!userSelectedNewCoverLandscapeFile) {
      formPatch['coverImageLandscape'] = coverLandscapeValue;
    }
    this.vendorForm.patchValue(formPatch);

    const socialLinksArray = this.vendorForm.get('socialLinks') as FormArray;
    socialLinksArray.clear();
    const rawSocialLinks = Array.isArray(data.socialLinks)
      ? data.socialLinks
      : Array.isArray(data.links)
        ? data.links.map((url: string) => ({ url }))
        : [];

    const normalizedSocialLinks = rawSocialLinks
      .map((item: unknown): VendorSocialLink | null => {
        if (typeof item === 'string' && item.trim()) {
          return { url: item.trim() };
        }
        if (item && typeof item === 'object' && typeof (item as VendorSocialLink).url === 'string') {
          const socialLink = item as VendorSocialLink;
          return {
            url: socialLink.url.trim(),
            ...(socialLink.platform ? { platform: socialLink.platform } : {}),
            ...(socialLink.accountName ? { accountName: socialLink.accountName.trim() } : {}),
          };
        }
        return null;
      })
      .filter((item: VendorSocialLink | null): item is VendorSocialLink => item !== null && item.url.length > 0);

    normalizedSocialLinks.forEach((socialLink: VendorSocialLink) => {
      socialLinksArray.push(new FormControl(socialLink));
    });

    // Handle locations - can be Location[] or string; normalize to array
    const locationsArray = this.vendorForm.get('locations') as FormArray;
    locationsArray.clear();
    let locations: any[] = [];
    const rawLocations = data.locations;
    if (rawLocations != null) {
      if (Array.isArray(rawLocations)) {
        locations = rawLocations;
      } else if (typeof rawLocations === 'string') {
        try {
          const parsed = JSON.parse(rawLocations);
          locations = Array.isArray(parsed) ? parsed : [];
        } catch {
          locations = [];
        }
      } else if (typeof rawLocations === 'object' && !Array.isArray(rawLocations) && rawLocations !== null) {
        // Firestore or other clients may return object with numeric keys
        locations = Object.keys(rawLocations)
          .filter(k => /^\d+$/.test(k))
          .map(k => rawLocations[k]);
      }
    }

    if (locations.length > 0) {
      locations.forEach((loc: any) => {
        const item = loc && typeof loc === 'object' ? loc : {};
        const locationGroup = this.fb.group({
          id: [this.getLocationId(item)],
          branchName: [item.branch_name ?? item.branchName ?? ''],
          branchNameAr: [item.branch_name_ar ?? item.branchNameAr ?? ''],
          country: [item.country ?? ''],
          country_ar: [item.country_ar ?? ''],
          region: [item.region ?? ''],
          region_ar: [item.region_ar ?? ''],
          city: [item.city ?? ''],
          city_ar: [item.city_ar ?? ''],
          address: [item.address ?? ''],
          googleMapLink: [item.link ?? item.googleMapLink ?? ''],
          representativeName: [item.branchRepresentativeName ?? item.representativeName ?? ''],
          phoneNumber: [item.branchPhoneNumber ?? item.phoneNumber ?? ''],
          latitude: [item.latitude != null ? Number(item.latitude) : null as number | null],
          longitude: [item.longitude != null ? Number(item.longitude) : null as number | null],
          offersCount: [this.getLocationOffersCount(item)],
        });
        this.setupMapLinkSubscription(locationGroup);
        locationsArray.push(locationGroup);
      });
    }

    const hasPendingImageUpload =
      this.vendorForm.get('logo')?.value instanceof File ||
      this.vendorForm.get('coverImage')?.value instanceof File ||
      this.vendorForm.get('coverImageLandscape')?.value instanceof File;
    if (!hasPendingImageUpload) {
      this.vendorForm.markAsPristine();
    }

    const vendorId =
      typeof (data as any)?._id === 'string'
        ? (data as any)._id
        : typeof (data as any)?._id?.$oid === 'string'
          ? (data as any)._id.$oid
          : null;
    if (vendorId) {
      this.lastPatchedVendorId = vendorId;
    }
  }

  private normalizeId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && '$oid' in value) {
      const id = (value as { $oid?: unknown }).$oid;
      return typeof id === 'string' ? id : '';
    }
    return String(value);
  }

  private getLocationId(loc: any): string {
    return (
      this.normalizeId(loc?._id) ||
      this.normalizeId(loc?.id) ||
      this.normalizeId(loc?.locationId) ||
      this.normalizeId(loc?.location_id)
    );
  }

  private pendingDeleteLocation(): any | null {
    const index = this.pendingDeleteLocationIndex;
    if (index === null) return null;
    return this.locations.at(index)?.value ?? null;
  }

  private getLocationOffersCount(loc: any): number {
    const rawCount = typeof loc?.offersCount === 'number'
      ? loc.offersCount
      : typeof loc?.offersCount === 'string'
        ? Number(loc.offersCount)
        : null;

    return rawCount != null && Number.isFinite(rawCount) ? rawCount : 0;
  }

  private isDeletingLastLocation(): boolean {
    return this.locations.length <= 1;
  }

  private getDeleteLocationErrorMessage(err: any): string {
    const detail =
      err?.error?.message ||
      err?.error?.error ||
      err?.message;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    return 'Failed to delete branch. Please try again.';
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      control.markAsDirty();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }

      if (control instanceof FormArray) {
        control.controls.forEach(ctrl => {
          ctrl.markAsTouched();
          ctrl.markAsDirty();
        });
      }
    });
  }

  backNavigation() {
    const route = this.backNavRouteLink();
    if (route) {
      this.router.navigate([route]);
    }
  }

  getAddVendorIconPath(iconName: string): string {
    return resolveAssetUrl(this.document, `svg/vendors/add-vendor/${iconName}`);
  }

  getVendorIconMask(iconName: string): string {
    return resolveMaskImageStyle(this.document, `svg/vendors/add-vendor/${iconName}`);
  }

  getUploadIconMask(): string {
    return resolveUploadIconMaskStyle(this.document);
  }

  private resolveSocialAsset(iconFile: string): string {
    return resolveAssetUrl(this.document, `svg/social-media/${iconFile}`);
  }

  ngOnDestroy(): void {
    this.resetCropperSourceObjectUrl();
    const url = this.logoPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    const coverUrl = this.coverPreviewUrl();
    if (coverUrl) {
      URL.revokeObjectURL(coverUrl);
    }
    const coverLandscapeUrl = this.coverLandscapePreviewUrl();
    if (coverLandscapeUrl) {
      URL.revokeObjectURL(coverLandscapeUrl);
    }
  }
}
