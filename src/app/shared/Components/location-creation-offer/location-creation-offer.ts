import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output, signal, computed } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';
import { PrimeUIModules } from '../../../core/prime.import';
import { MapUrlCoordinatesService } from '../../../features/vendors/services/map-url-coordinates.service';
import { AddNewVendorLocationService, AddVendorLocationRequest } from '../../../features/vendors/services/add-new-vendor-location';
import { GetVendorList } from '../../../features/vendors/services/get-vendor-list';
import { arabicOnlyValidator, noWhitespaceValidator } from '../vendor-form/vendor-form';
import { LocationSettingsService, SettingsLocation } from '../../../features/setting/services/location-settings.service';

@Component({
  selector: 'app-location-creation',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, ReactiveFormsModule],
  templateUrl: './location-creation-offer.html',
  styleUrl: './location-creation-offer.css',
})
export class LocationCreationOffer {
  @Input() visible = false;
  @Input() vendorId: string | null = null;
  @Input() locationData: AddVendorLocationRequest | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() locationAdded = new EventEmitter<void>();
  @Output() locationCreatedByData = new EventEmitter<AddVendorLocationRequest>();

  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly addNewVendorLocationService = inject(AddNewVendorLocationService);
  private readonly mapUrlCoordinatesService = inject(MapUrlCoordinatesService);
  private readonly getVendorListService = inject(GetVendorList);
  private readonly locationSettingsService = inject(LocationSettingsService);

  locationForm: FormGroup;
  loading = signal(false);
  readonly locationSettings = signal<SettingsLocation[]>([]);
  readonly selectedCountry = signal<string>('Saudi Arabia');
  readonly selectedRegion = signal<string>('');
  readonly locationPhoneError = signal(false);

  readonly countryOptions = computed(() =>
    [...new Set(this.locationSettings().map((l) => (l.country ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v })),
  );

  readonly regionOptions = computed(() => {
    const selectedCountry = this.selectedCountry();
    const regions = this.locationSettings()
      .filter((l) => !selectedCountry || String(l.country ?? '').trim() === selectedCountry)
      .map((l) => (l.region ?? '').trim())
      .filter(Boolean);
    return [...new Set(regions)]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  });

  readonly cityOptions = computed(() => {
    const selectedCountry = this.selectedCountry();
    const selectedRegion = this.selectedRegion();
    const cities = this.locationSettings()
      .filter((l) => !selectedCountry || String(l.country ?? '').trim() === selectedCountry)
      .filter((l) => !selectedRegion || String(l.region ?? '').trim() === selectedRegion)
      .map((l) => (l.city ?? '').trim())
      .filter(Boolean);
    return [...new Set(cities)]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  });
  private originalGoogleMapLink = '';

  constructor() {
    this.locationForm = this.fb.group({
      branchName: ['', [Validators.required, noWhitespaceValidator()]],
      branchNameAr: ['', [Validators.required, noWhitespaceValidator(), arabicOnlyValidator()]],
      country: ['Saudi Arabia', [Validators.required, noWhitespaceValidator()]],
      region: [''],
      city: ['', [Validators.required, noWhitespaceValidator()]],
      address: ['', [Validators.required, noWhitespaceValidator()]],
      googleMapLink: ['', [Validators.required, noWhitespaceValidator(), Validators.pattern(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/)]],
      representativeName: [''],
      phoneNumber: ['', [Validators.maxLength(20), Validators.pattern('^[0-9+() ]*$')]],
      latitude: [null as number | null],
      longitude: [null as number | null],
    });

    this.locationSettingsService.list().subscribe({
      next: (rows) => {
        this.locationSettings.set(Array.isArray(rows) ? rows : []);
      },
      error: () => {
        // eslint-disable-next-line no-console
        console.error('Failed to load location settings');
      },
    });

    // Keep signals in sync with form controls so computed() updates correctly.
    this.selectedCountry.set(String(this.locationForm.get('country')?.value ?? '').trim());
    this.selectedRegion.set(String(this.locationForm.get('region')?.value ?? '').trim());

    this.locationForm.get('country')?.valueChanges.subscribe((value) => {
      this.selectedCountry.set(String(value ?? '').trim());
      // Reset dependent fields if current value is no longer valid
      this.locationForm.patchValue({ region: '', city: '' }, { emitEvent: false });
      this.selectedRegion.set('');
    });

    this.locationForm.get('region')?.valueChanges.subscribe((value) => {
      this.selectedRegion.set(String(value ?? '').trim());
      this.locationForm.patchValue({ city: '' }, { emitEvent: false });
    });

    this.setupMapLinkSubscription();
  }

  ngOnChanges(changes: any) {
    if (changes.locationData && changes.locationData.currentValue) {
      this.populateForm(changes.locationData.currentValue);
    }
  }

  private populateForm(data: AddVendorLocationRequest) {
    this.originalGoogleMapLink = this.normalizeMapLink(data.link);
    this.locationForm.patchValue({
      branchName: data.branch_name,
      branchNameAr: data.branch_name_ar,
      country: data.country,
      region: data.region,
      city: data.city,
      address: data.address,
      googleMapLink: data.link,
      representativeName: (data as any).branchRepresentativeName ?? (data as any).representativeName ?? '',
      phoneNumber: (data as any).branchPhoneNumber ?? (data as any).phoneNumber ?? '',
      latitude: data.latitude,
      longitude: data.longitude,
    }, { emitEvent: false });

    // Keep signals aligned during edit patching.
    this.selectedCountry.set(String(data.country ?? '').trim());
    this.selectedRegion.set(String((data as any).region ?? '').trim());
  }

  sanitizePhoneNumber(event: Event) {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9+() ]/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
      this.locationForm.get('phoneNumber')?.setValue(sanitized, { emitEvent: false });
      this.locationPhoneError.set(true);
    } else {
      this.locationPhoneError.set(false);
    }
  }

  sanitizeArabicInput(controlName: string) {
    const control = this.locationForm.get(controlName);
    const currentValue = control?.value;
    if (typeof currentValue !== 'string') return;

    // Remove English letters
    const sanitizedValue = currentValue.replace(/[a-zA-Z]/g, '');
    if (sanitizedValue !== currentValue) {
      control?.setValue(sanitizedValue);
      control?.markAsTouched();
    }
  }

  private setupMapLinkSubscription(): void {
    this.locationForm.get('googleMapLink')?.valueChanges.pipe(
      debounceTime(500),
      switchMap((url: string | null) => {
        if (!url || !url.trim()) {
          this.locationForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
          return of(null);
        }
        this.locationForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
        const localCoords = this.mapUrlCoordinatesService.extractCoordinatesFromMapUrl(url);
        if (localCoords) {
          return of(localCoords);
        }

        return this.mapUrlCoordinatesService.getCoordinatesFromMapUrl(url).pipe(
          catchError(() => {
            this.messageService.add({
              severity: 'warn',
              summary: 'Invalid Map Link',
              detail: 'Could not resolve coordinates from the provided link.',
              life: 3000
            });
            this.locationForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
            return of(null);
          }),
        );
      }),
    ).subscribe((coords) => {
      if (coords) {
        this.locationForm.patchValue(
          { latitude: coords.latitude, longitude: coords.longitude },
          { emitEvent: false },
        );
      }
    });
  }

  onVisibleChange(visible: boolean) {
    this.visible = visible;
    this.visibleChange.emit(visible);
    if (!visible) {
      this.originalGoogleMapLink = '';
      this.locationForm.reset();
    }
  }

  close() {
    this.onVisibleChange(false);
  }

  async submit() {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please fill in all required fields.',
        life: 3000
      });
      return;
    }

    const value = this.locationForm.value;
    let latitude = value.latitude;
    let longitude = value.longitude;
    const normalizedCurrentLink = this.normalizeMapLink(value.googleMapLink);
    const isEditing = !!this.locationData;
    const shouldRefreshCoordinates =
      !!normalizedCurrentLink &&
      (
        latitude == null ||
        longitude == null ||
        (isEditing && normalizedCurrentLink !== this.originalGoogleMapLink)
      );

    if (shouldRefreshCoordinates) {
      this.loading.set(true);
      try {
        const coords =
          this.mapUrlCoordinatesService.extractCoordinatesFromMapUrl(value.googleMapLink) ??
          await firstValueFrom(
            this.mapUrlCoordinatesService.getCoordinatesFromMapUrl(value.googleMapLink),
          );
        latitude = coords.latitude;
        longitude = coords.longitude;
        this.locationForm.patchValue({ latitude, longitude }, { emitEvent: false });
      } catch {
        this.loading.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Map Link',
          detail: 'Could not resolve coordinates from the provided link.',
          life: 3000,
        });
        return;
      }
    }

    const settings = this.locationSettings();
    const matchedCountry = settings.find((l) => String(l.country ?? '').trim() === String(value.country ?? '').trim());
    const matchedRegion = settings.find(
      (l) =>
        String(l.country ?? '').trim() === String(value.country ?? '').trim() &&
        String(l.region ?? '').trim() === String(value.region ?? '').trim(),
    );
    const matchedCity = settings.find(
      (l) =>
        String(l.country ?? '').trim() === String(value.country ?? '').trim() &&
        (!value.region || String(l.region ?? '').trim() === String(value.region ?? '').trim()) &&
        String(l.city ?? '').trim() === String(value.city ?? '').trim(),
    );

    const payload: AddVendorLocationRequest = {
      id: this.locationData?.id,
      branch_name: value.branchName,
      branch_name_ar: value.branchNameAr || '',
      country: value.country,
      country_ar: matchedCountry?.country_ar || '',
      region: value.region,
      region_ar: matchedRegion?.region_ar || '',
      city: value.city,
      city_ar: matchedCity?.city_ar || '',
      address: value.address,
      link: value.googleMapLink || '',
      branchRepresentativeName: value.representativeName,
      branchPhoneNumber: value.phoneNumber,
      latitude,
      longitude,
      geohash: '',
    };

    if (!this.vendorId) {
      this.loading.set(false);
      this.locationCreatedByData.emit(payload);
      this.close();
      return;
    }

    const locationId = this.locationData?.id?.trim();

    if (isEditing && !locationId) {
      this.loading.set(false);
      this.messageService.add({
        severity: 'error',
        summary: 'Missing Location ID',
        detail: 'Cannot update this location because its ID was not found.',
        life: 3000,
      });
      return;
    }

    this.loading.set(true);
    const request$ = isEditing
      ? this.addNewVendorLocationService.updateLocation(this.vendorId, locationId!, payload)
      : this.addNewVendorLocationService.addLocation(this.vendorId, payload);

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: isEditing ? 'Location Updated' : 'Location Added',
          detail: isEditing
            ? 'Vendor location has been updated successfully.'
            : 'New vendor location has been added successfully.',
          life: 3000
        });
        this.locationAdded.emit();
        this.close();
      },
      error: (err: any) => {
        if (isEditing && this.vendorId && locationId) {
          void this.handlePossibleSuccessfulEditAfterError(locationId, payload, err);
          return;
        }

        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message || (isEditing ? 'Failed to update vendor location.' : 'Failed to add vendor location.'),
          life: 3000
        });
      }
    });
  }

  private async handlePossibleSuccessfulEditAfterError(
    locationId: string,
    payload: AddVendorLocationRequest,
    err: any,
  ) {
    try {
      const locations = await firstValueFrom(this.getVendorListService.getVendorLocationsById(this.vendorId!));
      const updatedLocation = (locations ?? []).find((loc: any) => this.normalizeId(loc) === locationId);

      if (updatedLocation && this.locationMatchesPayload(updatedLocation, payload)) {
        this.loading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Location Updated',
          detail: 'Vendor location was updated successfully.',
          life: 3000
        });
        this.locationAdded.emit();
        this.close();
        return;
      }
    } catch {
      // If verification fails, fall back to the original error toast below.
    }

    this.loading.set(false);
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: err.message || 'Failed to update vendor location.',
      life: 3000
    });
  }

  private normalizeId(loc: any): string {
    const rawId =
      loc?.id ??
      loc?._id?.$oid ??
      loc?._id ??
      loc?.__id__?.$oid ??
      loc?.__id__ ??
      loc?.locationId ??
      loc?.location_id ??
      '';

    return typeof rawId === 'string' ? rawId.trim() : String(rawId).trim();
  }

  private locationMatchesPayload(loc: any, payload: AddVendorLocationRequest): boolean {
    const normalizedLink = String(loc?.link ?? loc?.googleMapLink ?? loc?.googleMapsLink ?? '').trim();
    const normalizedAddress = String(loc?.address ?? loc?.fullAddress ?? '').trim();

    return (
      String(loc?.branch_name ?? '').trim() === String(payload.branch_name ?? '').trim() &&
      String(loc?.branch_name_ar ?? '').trim() === String(payload.branch_name_ar ?? '').trim() &&
      String(loc?.country ?? '').trim() === String(payload.country ?? '').trim() &&
      String(loc?.region ?? '').trim() === String(payload.region ?? '').trim() &&
      String(loc?.city ?? '').trim() === String(payload.city ?? '').trim() &&
      normalizedAddress === String(payload.address ?? '').trim() &&
      normalizedLink === String(payload.link ?? '').trim()
    );
  }

  private normalizeMapLink(value: unknown): string {
    return String(value ?? '').trim();
  }
}

