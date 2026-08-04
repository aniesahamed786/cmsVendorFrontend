import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { noWhitespaceValidator } from '../../../../shared/utils/form-validators';
import { getChangedFields } from '../../../../shared/utils/object-diff';
import { MapUrlCoordinatesService } from '../../../../features/vendors/services/map-url-coordinates.service';
import {
  LocationSettingsService,
  SettingsLocation,
} from '../../../../features/setting/services/location-settings.service';

export interface GeoPoint {
  type: 'Point';
  /** [longitude, latitude] — GeoJSON order, NOT [lat, lng]. */
  coordinates: [number, number];
}

export interface BranchApiPayload {
  branch_name: string;
  branch_name_ar: string;
  country: string;
  country_ar: string;
  region: string;
  region_ar: string;
  city: string;
  city_ar: string;
  address: string;
  link: string;
  branchRepresentativeName: string;
  branchPhoneNumber: string;
  settingsLocationId?: string;
  geoPoint: GeoPoint;
}

type LocationSettingsRow = SettingsLocation & {
  country_ar?: string;
  region_ar?: string;
  city_ar?: string;
};

export type BranchDraftPayload = Omit<BranchApiPayload, 'geoPoint'> & {
  geoPoint?: GeoPoint;
};

export interface BranchFormSubmit {
  payload: BranchDraftPayload;
  changedFields: Record<string, unknown>;
}

function arabicOnlyValidator(): ValidatorFn {
  const arabicPattern = /^[\u0600-\u06FF\u0660-\u0669\s]+$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }
    return arabicPattern.test(value) ? null : { arabicOnly: true };
  };
}

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrimeUIModules,
    RouterLink,
    Button,
    TranslatePipe,
  ],
  templateUrl: './branch-form.html',
  styleUrl: './branch-form.scss',
})
export class BranchForm {
  private readonly phonePattern = /^[0-9+() ]*$/;
  private readonly urlPattern =
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .@?&=%_+!~*'()#,:;-]*\/?$/;

  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly mapUrlCoordinatesService = inject(MapUrlCoordinatesService);
  private readonly locationSettingsService = inject(LocationSettingsService);

  actionType = input<'create' | 'edit'>('create');
  buttonName = input<string>('Save');
  backNavRouteLink = input<string>('');
  editableFormData = input<BranchApiPayload | null>(null);
  isLoading = input<boolean>(false);

  submitBranchFormEvent = output<BranchFormSubmit>();
  saveDraftEvent = output<BranchFormSubmit>();

  branchForm: FormGroup;

  private readonly resolvingCoordinates = signal(false);
  readonly locationPhoneError = signal(false);

  private readonly locationSettings = signal<LocationSettingsRow[]>([]);
  private readonly selectedCountry = signal<string>('Saudi Arabia');
  private readonly selectedRegion = signal<string>('');
  private incomingSettingsLocationId: string | undefined;
  private originalGoogleMapLink = '';

  readonly countryOptions = computed(() =>
    [...new Set(this.locationSettings().map((l) => (l.country ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v })),
  );

  readonly regionOptions = computed(() => {
    const country = this.selectedCountry();
    const regions = this.locationSettings()
      .filter((l) => !country || String(l.country ?? '').trim() === country)
      .map((l) => (l.region ?? '').trim())
      .filter(Boolean);
    return [...new Set(regions)]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  });

  readonly cityOptions = computed(() => {
    const country = this.selectedCountry();
    const region = this.selectedRegion();
    const cities = this.locationSettings()
      .filter((l) => !country || String(l.country ?? '').trim() === country)
      .filter((l) => !region || String(l.region ?? '').trim() === region)
      .map((l) => (l.city ?? '').trim())
      .filter(Boolean);
    return [...new Set(cities)]
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  });

  constructor() {
    this.branchForm = this.fb.group({
      locationNameEn: ['', [Validators.required, noWhitespaceValidator()]],
      locationNameAr: ['', [Validators.required, noWhitespaceValidator(), arabicOnlyValidator()]],
      country: ['Saudi Arabia', [Validators.required, noWhitespaceValidator()]],
      region: [''],
      city: ['', [Validators.required, noWhitespaceValidator()]],
      address: ['', [Validators.required, noWhitespaceValidator()]],
      googleMapLink: [
        '',
        [Validators.required, noWhitespaceValidator(), Validators.pattern(this.urlPattern)],
      ],
      representativeName: [''],
      phoneNumber: ['', [Validators.maxLength(20), Validators.pattern(this.phonePattern)]],
      latitude: [null as number | null],
      longitude: [null as number | null],
    });

    this.locationSettingsService.list().subscribe({
      next: (rows) => this.locationSettings.set(Array.isArray(rows) ? rows : []),
      error: () => console.error('[BranchForm] Failed to load location settings'),
    });

    this.selectedCountry.set(String(this.branchForm.get('country')?.value ?? '').trim());
    this.selectedRegion.set(String(this.branchForm.get('region')?.value ?? '').trim());

    this.branchForm.get('country')?.valueChanges.subscribe((value) => {
      this.selectedCountry.set(String(value ?? '').trim());
      this.branchForm.patchValue({ region: '', city: '' }, { emitEvent: false });
      this.selectedRegion.set('');
    });

    this.branchForm.get('region')?.valueChanges.subscribe((value) => {
      this.selectedRegion.set(String(value ?? '').trim());
      this.branchForm.patchValue({ city: '' }, { emitEvent: false });
    });

    this.setupMapLinkSubscription();

    effect(() => {
      const data = this.editableFormData();
      if (!data) {
        return;
      }
      this.originalGoogleMapLink = String(data.link ?? '').trim();
      this.incomingSettingsLocationId = data.settingsLocationId;
      const [longitude, latitude] = data.geoPoint?.coordinates ?? [null, null];

      this.branchForm.patchValue(
        {
          locationNameEn: data.branch_name,
          locationNameAr: data.branch_name_ar,
          country: data.country,
          region: data.region,
          city: data.city,
          address: data.address,
          googleMapLink: data.link,
          representativeName: data.branchRepresentativeName,
          phoneNumber: data.branchPhoneNumber,
          latitude,
          longitude,
        },
        { emitEvent: false },
      );

      this.selectedCountry.set(String(data.country ?? '').trim());
      this.selectedRegion.set(String(data.region ?? '').trim());
    });
  }

  get isEditMode(): boolean {
    return this.actionType() === 'edit';
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.branchForm.get(controlName);
    return (
      !!control &&
      control.touched &&
      (control.hasError('required') || control.hasError('whitespace'))
    );
  }

  hasFieldError(controlName: string, errorKey: string): boolean {
    const control = this.branchForm.get(controlName);
    return !!control && control.touched && control.hasError(errorKey);
  }

  isSubmitDisabled(): boolean {
    return this.isLoading() || this.resolvingCoordinates();
  }

  sanitizeArabicInput(controlName: string): void {
    const control = this.branchForm.get(controlName);
    const currentValue = control?.value;
    if (typeof currentValue !== 'string') {
      return;
    }
    const sanitized = currentValue.replace(/[a-zA-Z]/g, '');
    if (sanitized !== currentValue) {
      control?.setValue(sanitized);
      control?.markAsTouched();
    }
  }

  sanitizePhoneNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^0-9+() ]/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
      this.branchForm.get('phoneNumber')?.setValue(sanitized, { emitEvent: false });
      this.locationPhoneError.set(true);
    } else {
      this.locationPhoneError.set(false);
    }
  }

  private setupMapLinkSubscription(): void {
    this.branchForm
      .get('googleMapLink')
      ?.valueChanges.pipe(
        debounceTime(500),
        switchMap((url: string | null) => {
          if (!url || !url.trim()) {
            this.branchForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
            return of(null);
          }
          this.branchForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
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
                life: 3000,
              });
              this.branchForm.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
              return of(null);
            }),
          );
        }),
      )
      .subscribe((coords) => {
        if (coords) {
          this.branchForm.patchValue(
            { latitude: coords.latitude, longitude: coords.longitude },
            { emitEvent: false },
          );
        }
      });
  }

  async submit(): Promise<void> {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    const value = this.branchForm.value;
    let latitude: number | null = value.latitude;
    let longitude: number | null = value.longitude;
    const normalizedCurrentLink = String(value.googleMapLink ?? '').trim();
    const shouldRefreshCoordinates =
      !!normalizedCurrentLink &&
      (latitude == null || longitude == null || normalizedCurrentLink !== this.originalGoogleMapLink);

    if (shouldRefreshCoordinates) {
      this.resolvingCoordinates.set(true);
      try {
        const coords =
          this.mapUrlCoordinatesService.extractCoordinatesFromMapUrl(value.googleMapLink) ??
          (await firstValueFrom(this.mapUrlCoordinatesService.getCoordinatesFromMapUrl(value.googleMapLink)));
        latitude = coords.latitude;
        longitude = coords.longitude;
        this.branchForm.patchValue({ latitude, longitude }, { emitEvent: false });
      } catch {
        this.resolvingCoordinates.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Map Link',
          detail: 'Could not resolve coordinates from the provided link.',
          life: 3000,
        });
        return;
      }
      this.resolvingCoordinates.set(false);
    }

    if (latitude == null || longitude == null) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Coordinates',
        detail: 'Could not determine a location from the Google Map link.',
        life: 3000,
      });
      return;
    }

    const payload = this.buildApiPayload(latitude, longitude);
    const changedFields = this.diffAgainstBaseline(payload);
    const result: BranchFormSubmit = { payload, changedFields };
    console.log('[BranchForm] Submit values:', result);
    this.submitBranchFormEvent.emit(result);
  }

  onSaveDraft(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }

    const value = this.branchForm.value;
    const payload = this.buildApiPayload(value.latitude, value.longitude);
    const changedFields = this.diffAgainstBaseline(payload);
    const result: BranchFormSubmit = { payload, changedFields };
    console.log('[BranchForm] Save Draft values:', result);
    this.saveDraftEvent.emit(result);
  }

  private diffAgainstBaseline(payload: BranchDraftPayload): Record<string, unknown> {
    const baseline = this.editableFormData();
    return getChangedFields(
      (baseline as unknown as Record<string, unknown>) ?? null,
      payload as unknown as Record<string, unknown>,
      { dropFiles: true },
    );
  }

  private buildApiPayload(
    latitude: number | null,
    longitude: number | null,
  ): BranchDraftPayload {
    const form = this.branchForm.value;
    const settings = this.locationSettings();
    const country = String(form.country ?? '').trim();
    const region = String(form.region ?? '').trim();
    const city = String(form.city ?? '').trim();

    const countryMatch = settings.find((l) => String(l.country ?? '').trim() === country);
    const regionMatch = settings.find(
      (l) =>
        String(l.country ?? '').trim() === country &&
        (!region || String(l.region ?? '').trim() === region),
    );
    const cityMatch = settings.find(
      (l) =>
        String(l.country ?? '').trim() === country &&
        (!region || String(l.region ?? '').trim() === region) &&
        String(l.city ?? '').trim() === city,
    );

    const settingsLocationId = cityMatch
      ? typeof cityMatch._id === 'string'
        ? cityMatch._id
        : cityMatch._id.$oid
      : this.incomingSettingsLocationId;

    return {
      branch_name: form.locationNameEn?.trim() ?? '',
      branch_name_ar: form.locationNameAr?.trim() ?? '',
      country,
      country_ar: countryMatch?.country_ar ?? '',
      region,
      region_ar: regionMatch?.region_ar ?? '',
      city,
      city_ar: cityMatch?.city_ar ?? '',
      address: form.address?.trim() ?? '',
      link: form.googleMapLink?.trim() ?? '',
      branchRepresentativeName: form.representativeName?.trim() ?? '',
      branchPhoneNumber: form.phoneNumber?.trim() ?? '',
      ...(settingsLocationId ? { settingsLocationId } : {}),
      ...(latitude != null && longitude != null
        ? { geoPoint: { type: 'Point' as const, coordinates: [longitude, latitude] as [number, number] } }
        : {}),
    };
  }
}