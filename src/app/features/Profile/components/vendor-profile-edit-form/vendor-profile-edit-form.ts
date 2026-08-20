import { CommonModule, DOCUMENT } from '@angular/common';
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
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImageCropperComponent, ImageCroppedEvent } from 'ngx-image-cropper';
import { PrimeUIModules } from '../../../../core/prime.import';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { Button } from '../../../../shared/Components/button/button';
import { CancelButton } from '../../../../shared/Components/cancel-button/cancel-button';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import {
  VendorProfileEditData,
  VendorProfileEditLocation,
} from '../../models/vendor-profile-edit.model';
import { VendorSocialLink } from '../../../vendors/models/createNewVendor';
import { toVendorSchemaPayload } from '../../models/vendor-profile-request.mapper';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { toVendorMediaUrl } from '../../../../shared/utils/media-url';
import { resolveAssetUrl, resolveMaskImageStyle } from '../../../../shared/utils/resolve-asset-url';

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
export type SocialLinkType = 'instagram' | 'whatsapp' | 'tiktok' | 'x' | 'snapchat' | 'linkedin' | 'facebook' | 'youtube' | 'other';

@Component({
  selector: 'app-vendor-profile-edit-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PrimeUIModules,
    TranslatePipe,
    ImageCropperComponent,
    Button,
    CancelButton,
  ],
  templateUrl: './vendor-profile-edit-form.html',
  styleUrl: './vendor-profile-edit-form.css',
})
export class VendorProfileEditForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

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
  readonly previewSocialLinks = signal<VendorSocialLink[]>([]);
  /**
   * Locations are not editable here — branches are their own STORE entity and a PROFILE
   * request cannot carry them. The signal stays so the loaded profile's branches can still
   * feed the live preview read-only; nothing in this form writes to it.
   */
  readonly savedLocations = signal<VendorProfileEditLocation[]>([]);

  // ── Social Media State ──
  editingLinkIndex = signal<number | null>(null);
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

  // ── Branding image previews (blob/object URLs shown in the form + live preview) ──
  readonly logoPreview = signal<string | null>(null);
  readonly logoFileName = signal<string | null>(null);
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
    accountNameInput: [''],
    linkinput: ['', Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/)],
    socialLinks: this.fb.array<FormControl<VendorSocialLink | null>>([]),
    logo: [null as string | File | null, Validators.required],
    coverMobile: [null as string | File | null, Validators.required],
    coverDesktop: [null as string | File | null, Validators.required],
  });

  /**
   * The profile as it was loaded. Save-time diffs and the "anything changed yet?" check both
   * compare against this, so the action buttons stay disabled until there is something to save.
   */
  private readonly baselineData = signal<VendorProfileEditData | null>(null);

  /**
   * Live mirror of the reactive form. This app runs zoneless, so `profileForm.dirty` alone
   * would never re-render the buttons — the value has to live in a signal for `hasChanges()`
   * to re-evaluate.
   */
  private readonly formValue = signal(this.profileForm.getRawValue());

  /** The form's current state in the shape the parent is handed on save. */
  readonly currentData = computed<VendorProfileEditData>(() => {
    const value = this.formValue();
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
      socialLinks: this.getRawSocialLinks(),
      locations: this.savedLocations(),
      logo: value.logo ?? null,
      coverMobile: value.coverMobile ?? null,
      coverDesktop: value.coverDesktop ?? null,
    };
  });

  /** Only the vendor-schema fields that differ from the loaded profile. */
  readonly changedFields = computed<Record<string, unknown>>(() => {
    const baseline = this.baselineData();
    if (!baseline) return {};
    return getChangedFields(
      toVendorSchemaPayload(baseline),
      toVendorSchemaPayload(this.currentData()),
    );
  });

  /** Drives the parent's Save-as-draft / Update-changes buttons. */
  readonly hasChanges = computed(() => Object.keys(this.changedFields()).length > 0);

  get socialLinks(): FormArray {
    return this.profileForm.get('socialLinks') as FormArray;
  }

  ngOnInit(): void {
    this.patchForm(this.initialData());
    this.savedLocations.set([...this.initialData().locations]);
    this.previewSocialLinks.set(this.getRawSocialLinks());
    this.formValue.set(this.profileForm.getRawValue());
    this.baselineData.set(this.currentData());
    this.syncPreview();

    this.profileForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValue.set(this.profileForm.getRawValue());
        this.syncPreview();
      });
  }

  /**
   * Re-seed the form when the profile arrives from the API after first render, and reset the
   * baseline so freshly-loaded values don't count as edits.
   */
  reset(data: VendorProfileEditData): void {
    this.patchForm(data);
    this.savedLocations.set([...data.locations]);
    this.previewSocialLinks.set(this.getRawSocialLinks());
    this.formValue.set(this.profileForm.getRawValue());
    this.baselineData.set(this.currentData());
    this.profileForm.markAsPristine();
    this.syncPreview();
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
      accountNameInput: '',
      linkinput: '',
      logo: data.logo ?? null,
      coverMobile: data.coverMobile ?? null,
      coverDesktop: data.coverDesktop ?? null,
    });

    this.socialLinks.clear();
    const links = data.socialLinks || [];
    for (const item of links) {
      const url = this.getSocialLinkUrl(item);
      if (url) {
        const platform = this.getSocialLinkPlatform(item);
        const accountName = this.getSocialLinkAccountName(item);
        this.socialLinks.push(
          new FormControl<VendorSocialLink>({
            url,
            ...(platform ? { platform } : {}),
            ...(accountName ? { accountName } : {}),
          }),
        );
      }
    }

    // Seed previews for any images that arrive as ready-made URLs. Stored paths are unscoped
    // (`/api/v1/media/...`) and only servable off the vendor media proxy — the form controls above
    // keep the raw value so the saved payload stays unchanged.
    if (typeof data.logo === 'string') this.logoPreview.set(toVendorMediaUrl(data.logo));
    if (typeof data.coverMobile === 'string') this.coverMobilePreview.set(toVendorMediaUrl(data.coverMobile));
    if (typeof data.coverDesktop === 'string') this.coverDesktopPreview.set(toVendorMediaUrl(data.coverDesktop));
  }

  private syncPreview(): void {
    const value = this.profileForm.getRawValue();
    const links = this.getRawSocialLinks();
    this.previewSocialLinks.set(links);
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

  getRawSocialLinks(): VendorSocialLink[] {
    const rawLinks = this.socialLinks?.getRawValue?.();
    if (!Array.isArray(rawLinks)) return [];

    return rawLinks
      .map((value: unknown): VendorSocialLink | null => {
        const url = this.getSocialLinkUrl(value);
        if (!url) return null;
        const platform = this.getSocialLinkPlatform(value);
        const accountName = this.getSocialLinkAccountName(value);
        return {
          url,
          ...(platform ? { platform } : {}),
          ...(accountName ? { accountName } : {}),
        };
      })
      .filter((item): item is VendorSocialLink => item !== null);
  }

  // ── Social Media Management Methods ──

  addLink(): void {
    const selectedType = this.selectedSocialLinkType();
    const value = this.profileForm.get('linkinput')?.value;
    const accountNameValue = this.profileForm.get('accountNameInput')?.value;
    if (!selectedType || !value?.trim()) return;

    this.socialLinks.push(
      new FormControl<VendorSocialLink>({
        url: value.trim(),
        ...(selectedType ? { platform: selectedType } : {}),
        ...(typeof accountNameValue === 'string' && accountNameValue.trim()
          ? { accountName: accountNameValue.trim() }
          : {}),
      }),
    );

    this.profileForm.get('accountNameInput')?.reset('');
    this.profileForm.get('linkinput')?.reset('');
    this.profileForm.markAsDirty();
    this.formValue.set(this.profileForm.getRawValue());
    this.syncPreview();
  }

  selectSocialLinkType(type: SocialLinkType): void {
    this.selectedSocialLinkType.update((currentType) => (currentType === type ? null : type));
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
        const username = pathParts.find((p) => p.startsWith('@'));
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

  getSocialLinkIconPath(value: unknown, _index?: number): string | null {
    const explicitType = this.getSocialLinkPlatform(value);
    if (explicitType) {
      return this.resolveSocialIconPathFromType(explicitType);
    }
    return null;
  }

  getSocialLinkIconClass(value: unknown, _index?: number): string {
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
      const candidatePlatform =
        typeof socialLink.platform === 'string'
          ? socialLink.platform
          : typeof socialLink['type'] === 'string'
            ? (socialLink['type'] as string)
            : typeof socialLink['platformType'] === 'string'
              ? (socialLink['platformType'] as string)
              : typeof socialLink['socialMediaType'] === 'string'
                ? (socialLink['socialMediaType'] as string)
                : '';

      return this.normalizeSocialLinkType(candidatePlatform.trim().toLowerCase());
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes('instagram.com')) return 'instagram';
      if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook';
      if (lower.includes('x.com') || lower.includes('twitter.com')) return 'x';
      if (lower.includes('whatsapp') || lower.includes('wa.me')) return 'whatsapp';
      if (lower.includes('tiktok.com')) return 'tiktok';
      if (lower.includes('linkedin.com')) return 'linkedin';
      if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
      if (lower.includes('snapchat.com')) return 'snapchat';
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

  removeLink(index: number): void {
    this.socialLinks.removeAt(index);
    if (this.editingLinkIndex() === index) {
      this.cancelEditLink();
    }
    this.profileForm.markAsDirty();
    this.formValue.set(this.profileForm.getRawValue());
    this.syncPreview();
  }

  editLink(index: number): void {
    const value = this.socialLinks.at(index)?.value;
    this.editingLinkIndex.set(index);
    this.editingLinkValue.set(this.getSocialLinkUrl(value));
    this.editingLinkAccountName.set(this.getSocialLinkAccountName(value));
  }

  updateEditingLinkValue(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editingLinkValue.set(input.value);
  }

  updateEditingLinkAccountName(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editingLinkAccountName.set(input.value);
  }

  saveEditLink(index: number): void {
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
    this.profileForm.markAsDirty();
    this.formValue.set(this.profileForm.getRawValue());
    this.syncPreview();
  }

  cancelEditLink(): void {
    this.editingLinkIndex.set(null);
    this.editingLinkValue.set('');
    this.editingLinkAccountName.set('');
  }

  getVendorIconMask(iconName: string): string {
    return resolveMaskImageStyle(this.document, `svg/vendors/add-vendor/${iconName}`);
  }

  private resolveSocialAsset(iconFile: string): string {
    return resolveAssetUrl(this.document, `svg/social-media/${iconFile}`);
  }

  private buildPayload(): VendorProfileEditData {
    // Keep the emitted value and the change detection reading the exact same source.
    this.formValue.set(this.profileForm.getRawValue());
    return this.currentData();
  }

  onSaveDraft(): void {
    this.saveDraft.emit(this.buildPayload());
  }

  onUpdateChanges(): void {
    this.updateChanges.emit(this.buildPayload());
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
    this.logoFileName.set(null);
    this.setImage('logo', null);
  }

  private startLogoCrop(file: File): void {
    this.revoke(this.logoSource);
    this.logoSource = URL.createObjectURL(file);
    this.logoFileName.set(file.name);
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

  recropCover(target: 'mobile' | 'desktop'): void {
    if (!this.coverSource) return;
    this.chainToDesktopCrop = false;
    this.openCropper(target === 'mobile' ? 'coverMobile' : 'coverDesktop', this.coverSource);
  }

  removeCover(target: 'mobile' | 'desktop'): void {
    if (target === 'mobile') {
      this.revoke(this.coverMobilePreview());
      this.coverMobilePreview.set(null);
      this.setImage('coverMobile', null);
    } else {
      this.revoke(this.coverDesktopPreview());
      this.coverDesktopPreview.set(null);
      this.setImage('coverDesktop', null);
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
    const ext = this.cropBlob.type === 'image/jpeg' ? 'jpg' : 'png';
    const file = new File([this.cropBlob], `${this.pendingCropName}-${target}.${ext}`, {
      type: this.cropBlob.type || 'image/png',
    });
    const url = URL.createObjectURL(this.cropBlob);

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
