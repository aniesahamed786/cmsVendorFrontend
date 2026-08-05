import {
  Component,
  DestroyRef,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  ViewChild,
  HostListener,
} from "@angular/core";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  AbstractControl,
  FormBuilder,
  Validators,
  FormArray,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import {
  CreateOfferPayload,
  mapFormModeToOfferMode,
  mapOfferModeToFormMode,
} from "../../../features/Offers/models/createOffer";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { GetVendorList } from "../../../features/vendors/services/get-vendor-list";
import { GetVendorById } from "../../../features/vendors/services/get-vendor-by-id";
import {
  VendorDetails,
  getVendorStatus,
  isVendorInactive,
} from "../../../features/vendors/models/vendordetails";
import { CategoryDropdownComponent } from "../category-dropdown/category-dropdown";
import { TargetAudienceDropdownComponent } from "../target-audience-dropdown/target-audience-dropdown";
import { PreviewOfferDetails } from "../../../features/Offers/Components/preview-offer-details/preview-offer-details";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule, DOCUMENT } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import {
  resolveAssetUrl,
  resolveMaskImageStyle,
  resolveUploadIconMaskStyle,
} from "../../utils/resolve-asset-url";
import { MessageService } from "primeng/api";
import { PrimeUIModules } from "../../../core/prime.import";
import {
  Category,
  GetCategoriesService,
} from "../../services/get-categories.service";
import {
  OfferRoomDraft,
  RoomCreationOffer,
} from "../../../features/Offers/Components/room-creation-offer/room-creation-offer";
import { LocationCreationOffer } from "../location-creation-offer/location-creation-offer";
import {
  normalizeTagName,
  TagsListService,
} from "../../../features/setting/services/tags-list/tags-list";
import { AutoCompleteCompleteEvent } from "primeng/autocomplete";
import { noWhitespaceValidator } from "../../utils/form-validators";
import { ConfirmationPopUp } from "../confirmation-pop-up/confirmation-pop-up";
import { ImageCropperComponent, ImageCroppedEvent } from "ngx-image-cropper";
import {
  clearFileInputValue,
} from "../../utils/file-upload-validation";
import { Subject, of } from "rxjs";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
} from "rxjs/operators";
import { Button } from "../button/button";
import { CancelButton } from "../cancel-button/cancel-button";
import { toVendorMediaUrl } from "../../utils/media-url";
import { I18nService } from "../../i18n/i18n.service";
import { TranslatePipe } from "../../i18n/translate.pipe";
import { AuthService } from "../../../core/services/auth.service";
import { getChangedOfferFields } from "../../../features/Offers/models/offer-payload.diff";

/**
 * What the form emits on save. `payload` is the complete offer; `changedFields` is the diff
 * against the offer as it was loaded — empty in create mode, and what an UPDATE request must
 * send as `requestData`.
 */
export interface OfferFormSubmit {
  payload: CreateOfferPayload;
  changedFields: Record<string, unknown>;
}

@Component({
  selector: "app-offer-form",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    PrimeUIModules,
    CategoryDropdownComponent,
    TargetAudienceDropdownComponent,
    PreviewOfferDetails,
    CommonModule,
    RoomCreationOffer,
    LocationCreationOffer,
    ConfirmationPopUp,
    ImageCropperComponent,
    RouterLink,
    Button,
    CancelButton,
    TranslatePipe,
  ],
  templateUrl: "./offer-form.html",
  styleUrl: "./offer-form.css",
})
export class OfferForm {
  private readonly phonePattern = /^[\d\s()+-]+$/;
  private readonly discountNumericPattern = /^\d+([.,]\d+)?$/;
  private readonly discountEnNumericValidator = (control: AbstractControl) =>
    this.validateNumericDiscount(control);
  private readonly discountArNumericValidator = (control: AbstractControl) =>
    this.validateNumericDiscount(control);
  private readonly hotelRequiredControlNames = [
    "taxValue",
    "taxValueAr",
    "currency",
    "hotelAmenities",
    "hotelAmenitiesAr",
  ] as const;

  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly authService = inject(AuthService);
  /** The vendor is always the authenticated caller — no picker, just their own name. */
  readonly vendorDisplayName = computed(() => this.authService.getVendorAccount()?.name ?? "");
  readonly addOfferIconBasePath = "assets/svg/Offers/add-offer";
  submitOfferFormEvent = output<OfferFormSubmit>();
  saveDraftEvent = output<OfferFormSubmit>();
  actionType = input<string>("");
  buttonName = input<string>("Save");
  // Raw offer-document-shaped data (see mapOfferToForm) — not OfferFormModel, which is the
  // create-payload shape and doesn't match what this input is actually populated with.
  editableFormData = input<Record<string, unknown> | null>(null);
  backNavRouteLink = input<string>("");
  isLoading = input<boolean>(false);
  /**
   * Display URL for an already-stored image. The control keeps the API's own relative path,
   * since that is what goes back in the payload; only the `<img src>` is resolved.
   */
  imageSrc(value: unknown): string {
    return toVendorMediaUrl(value);
  }

  /** Hosts that already render their own back button turn this off to avoid a second one. */
  showBackNav = input<boolean>(true);
  /**
   * Which required-field profile to apply, independent of `actionType`.
   *
   * Edit mode normally relaxes the create-only requirements, because an existing offer is
   * already complete and the vendor may be touching one field. A pending request is not: it
   * has to stand on its own as the thing an admin approves, so the request-edit page prefills
   * like an edit (which is what drives `editableFormData`) but validates like a create.
   *
   * Empty means "follow `actionType`", so the create and edit pages behave exactly as before.
   */
  validationMode = input<"create" | "edit" | "">("");

  /** True when every create-time required field must be filled before the form can submit. */
  private requiresFullValidation(): boolean {
    return (this.validationMode() || this.actionType()) !== "edit";
  }
  /**
   * What the footer's secondary button does. `draft` saves a draft (the offer pages);
   * `cancel` just leaves (the request-edit page, where there is no separate draft to save).
   */
  secondaryAction = input<"draft" | "cancel">("draft");
  cancelEvent = output<void>();
  minDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  minExpiryDate = signal<Date>(new Date());
  offerForm!: FormGroup;
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly tagsListService = inject(TagsListService);
  @ViewChild("offerFileInput") offerFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild("highlightMobileFileInput")
  highlightMobileFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild("highlightDesktopFileInput")
  highlightDesktopFileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild(PreviewOfferDetails) previewComponent?: PreviewOfferDetails;

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement;
    const controlEl = target.closest('[formControlName]');
    if (controlEl) {
      const formControlName = controlEl.getAttribute('formControlName');
      if (formControlName && this.previewComponent) {
        this.previewComponent.scrollToSection(formControlName);
      }
    }
  }

  readonly showLocationDialog = signal(false);
  readonly phoneError = signal(false);
  readonly landlineError = signal(false);
  readonly tagInputTouched = signal(false);
  readonly tagDuplicateError = signal(false);
  private autoManagedTagNames = new Set<string>();
  private readonly vendorSearch$ = new Subject<string>();
  private readonly vendorPageSize = 25;
  private readonly vendorScrollThresholdPx = 64;
  private vendorDropdownScrollElement: HTMLElement | null = null;
  private vendorSearchTerm = "";
  private vendorCurrentPage = 0;
  private vendorTotalRecords = 0;
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private vendorlist: GetVendorList,
    private vendorById: GetVendorById,
    private categoriesService: GetCategoriesService,
  ) {
    this.destroyRef.onDestroy(() => {
      this.revokePreviewObjectUrl(this.previewUrl());
      this.revokePreviewObjectUrl(this.offerLandscapePreviewUrl());
      this.revokePreviewObjectUrl(this.highlightPreviewUrl());
      this.revokePreviewObjectUrl(this.highlightLandscapePreviewUrl());
      this.resetCropperSourceObjectUrl();
      this.detachVendorDropdownScrollListener();
    });
    this.offerForm = this.fb.group({
      selectedVendor: ["", Validators.required],
      titleEn: ["", [Validators.required, noWhitespaceValidator()]],
      titleAr: [
        "",
        [
          Validators.required,
          noWhitespaceValidator(),
          // arabicOnlyValidator(), // Arabic-only validation disabled
        ],
      ],
      descriptionEn: ["", [Validators.required, noWhitespaceValidator()]],
      descriptionAr: ["", [Validators.required, noWhitespaceValidator()]],
      discountEn: ["", Validators.required],
      discountAr: [""],
      discountCode: [""],
      startdate: ["", Validators.required],
      expiry: ["", [Validators.required, this.expiryDateValidator.bind(this)]],
      category: this.fb.control([], {
        nonNullable: true,
        validators: [Validators.required],
      }),
      targetAudience: this.fb.control<string[]>([], { nonNullable: true }),
      tagInput: [""],
      selectedTags: this.fb.array<FormControl>([]),
      instructionsEn: ["", [Validators.required, noWhitespaceValidator()]],
      instructionsAr: ["", [Validators.required, noWhitespaceValidator()]],
      offerImage: [null],
      offerImageLandscape: [null],
      urlLink: [
        "",
        Validators.pattern(
          /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/,
        ),
      ],
      storeWebsiteLink: [
        "",
        Validators.pattern(
          /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})[\/\w \.@?&=%_+!~*\'()#,:;-]*\/?$/,
        ),
      ],
      mode: this.fb.control<
        "In-Store" | "Digital" | "In-Store & Digital" | null
      >("In-Store", {
        validators: [Validators.required],
      }),
      hotelRating: ["rating" as "Yes" | "No"],
      phone: [
        "",
        [
          Validators.maxLength(15),
          Validators.pattern(/^[0-9+() ]*$/),
          this.optionalPhoneValidator.bind(this),
        ],
      ],
      email: ["", [Validators.email]],
      landline: [
        "",
        [
          Validators.maxLength(15),
          Validators.pattern(/^[0-9+() ]*$/),
          this.optionalPhoneValidator.bind(this),
        ],
      ],
      highlight: [false],
      discountType: this.fb.control<"Fixed" | "Percentage" | "Others" | null>(
        "Fixed",
        {
          validators: [Validators.required],
        },
      ),
      taxValue: [""],
      taxValueAr: [""],
      currency: [""],
      hotelAmenities: [""],
      hotelAmenitiesAr: [""],
      rooms: [null as number | null],
      highlightImage: [null],
      highlightImageLandscape: [null],
      highlightTitleEn: ["", [noWhitespaceValidator()]],
      highlightTitleAr: ["", [
        noWhitespaceValidator(),
        // arabicOnlyValidator(), // Arabic-only validation disabled
      ]],
      highlightDescription: ["", [noWhitespaceValidator()]],
      highlightDescriptionAr: ["", [noWhitespaceValidator()]],
      locationIds: this.fb.control<string[]>([], {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
    // No vendor picker — always the authenticated caller's own vendor.
    this.offerForm.get("selectedVendor")?.setValue(this.authService.getVendorId() ?? "");
  }
  vendors = signal<VendorDetails[]>([]);
  selectedVendorDetails = signal<VendorDetails | null>(null);
  vendorOptions = computed(() => {
    const selectedVendorId = this.offerForm.get("selectedVendor")?.value;

    return this.vendors().map((vendor) => {
      const value = String(vendor?._id?.$oid ?? vendor?._id ?? "");
      const status = getVendorStatus(vendor);

      return {
        label: `${vendor.name} (${status})`,
        value,
        disabled: status === "inactive" && value !== selectedVendorId,
      };
    });
  });
  categories = signal<Category[]>([]);
  vendorLocations = signal<
    Array<{ id: string; label: string; address?: string; city?: string }>
  >([]);
  locationsLoading = signal(false);
  readonly vendorsLoading = signal(false);
  readonly vendorsHasMore = signal(false);
  private categoriesLoading = signal(true);
  readonly initialLoading = computed(() => this.categoriesLoading());
  previewUrl = signal<string | ArrayBuffer | null>(null);
  offerLandscapePreviewUrl = signal<string | ArrayBuffer | null>(null);
  highlightPreviewUrl = signal<string | ArrayBuffer | null>(null);
  highlightLandscapePreviewUrl = signal<string | ArrayBuffer | null>(null);
  selectedOfferFileName = signal<string | null>(null);
  selectedOfferLandscapeFileName = signal<string | null>(null);
  selectedHighlightFileName = signal<string | null>(null);
  selectedHighlightLandscapeFileName = signal<string | null>(null);
  isOfferDragging = signal(false);
  isHighlightDragging = signal(false);
  readonly highlightEnabled = signal(false);
  readonly formPreviewValue = signal<any>({});
  readonly showRoomDialog = signal(false);
  readonly roomItems = signal<OfferRoomDraft[]>([]);
  readonly editingRoomIndex = signal<number | null>(null);
  readonly showConfirmationDialog = signal(false);
  /**
   * Follows the app language, but a field focus overrides it until the next
   * language switch — focusing the Arabic title should preview Arabic even
   * while the UI is in English.
   */
  readonly previewLanguage = linkedSignal<"en" | "ar">(() => this.i18n.lang());
  isSubmitting = signal(false);
  /**
   * Signal-backed mirror of `offerForm.dirty` for edit mode. This app runs zoneless (no
   * zone.js), so mutating `FormGroup.dirty` alone never triggers a re-render — the
   * Save/Update buttons' `[disabled]` binding only re-evaluates when a signal it reads
   * changes. `hasEditChanges()` reads this signal instead of `offerForm.dirty` directly.
   */
  private readonly hasUnsavedEditChanges = signal(false);
  /**
   * Set while the component patches the form itself, so those value changes are not
   * mistaken for user edits. Use `patchWithoutDirty()` rather than setting it directly.
   */
  private suppressDirtyTracking = false;
  /**
   * The offer payload as it was loaded, captured once the form is populated and pristine.
   * Save-time diffs are taken against this so an UPDATE request carries only real edits.
   */
  private editBaselinePayload: CreateOfferPayload | null = null;
  /** Tracks which offer was last patched into the form (edit mode). */
  private lastPatchedOfferId: string | null = null;
  private cropperSourceObjectUrl: string | null = null;
  private pendingCropInput: HTMLInputElement | null = null;
  private pendingCropFileName = "offer-image";
  private offerCropSource: File | string | null = null;
  private offerCropMobileBlob: Blob | null = null;
  private offerCropDesktopBlob: Blob | null = null;
  private offerZoomByTab: Record<"mobile" | "desktop", number> = {
    mobile: 1,
    desktop: 1,
  };
  private highlightCropSourceByTab: Record<"mobile" | "desktop", File | string | null> = {
    mobile: null,
    desktop: null,
  };
  private highlightCropMobileBlob: Blob | null = null;
  private highlightCropDesktopBlob: Blob | null = null;
  private highlightZoomByTab: Record<"mobile" | "desktop", number> = {
    mobile: 1,
    desktop: 1,
  };

  /**
   * Run a programmatic form update without it counting as a user edit. Nestable, and
   * restores the previous state even if `fn` throws.
   */
  private patchWithoutDirty(fn: () => void): void {
    const previous = this.suppressDirtyTracking;
    this.suppressDirtyTracking = true;
    try {
      fn();
    } finally {
      this.suppressDirtyTracking = previous;
      this.refreshEditBaselineIfPristine();
    }
  }

  /**
   * Re-snapshot the baseline after a programmatic patch, but only while the user has made no
   * edits. Some values land asynchronously (vendor locations resolve after the offer is
   * mapped), and without this they would show up in the save diff as user changes.
   */
  private refreshEditBaselineIfPristine(): void {
    if (this.actionType() !== "edit" || this.hasUnsavedEditChanges()) {
      return;
    }
    this.editBaselinePayload = this.mapFormToPayload(this.offerForm.value);
  }

  /** True when edit mode has user changes (including new image files). */
  hasEditChanges(): boolean {
    if (this.actionType() !== "edit") {
      return true;
    }
    if (this.hasUnsavedEditChanges()) {
      return true;
    }
    const offerImage = this.offerForm.get("offerImage")?.value;
    const offerImageLandscape = this.offerForm.get(
      "offerImageLandscape",
    )?.value;
    const highlightImage = this.offerForm.get("highlightImage")?.value;
    const highlightImageLandscape = this.offerForm.get(
      "highlightImageLandscape",
    )?.value;
    return (
      offerImage instanceof File ||
      offerImageLandscape instanceof File ||
      highlightImage instanceof File ||
      highlightImageLandscape instanceof File
    );
  }

  setPreviewLanguage(lang: "en" | "ar") {
    this.previewLanguage.set(lang);
  }
  suggestedTags = signal<string[]>([]);
  topTags = computed(() => {
    return [...this.tagsListService.tags()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((t) => t.name);
  });

  ngOnInit() {
    this.setupVendorSearch();
    this.loadInitialData();
    this.formPreviewValue.set(this.offerForm.getRawValue());

    const isEdit = this.actionType() === "edit";

    // If user navigated from vendor list action menu:
    // /offers/create?vendorId=<id>
    // preselect that vendor automatically on create page.
    if (!isEdit) {
      const vendorIdFromQuery =
        this.route.snapshot.queryParamMap.get("vendorId");
      const vendorControl = this.offerForm.get("selectedVendor");
      if (vendorIdFromQuery && vendorControl && !vendorControl.value) {
        vendorControl.setValue(vendorIdFromQuery);
      }
    }

    // Mandatory-only for create — and for anything that opted into create-level validation.
    if (this.requiresFullValidation()) {
      this.offerForm.get("titleAr")?.addValidators(Validators.required);
      this.offerForm.get("descriptionEn")?.addValidators(Validators.required);
      this.offerForm.get("descriptionAr")?.addValidators(Validators.required);
      this.offerForm.get("instructionsEn")?.addValidators(Validators.required);
      this.offerForm.get("instructionsAr")?.addValidators(Validators.required);
      this.offerForm.get("offerImage")?.addValidators(Validators.required);
      this.offerForm
        .get("offerImageLandscape")
        ?.addValidators(Validators.required);

      this.offerForm.get("titleAr")?.updateValueAndValidity();
      this.offerForm.get("descriptionEn")?.updateValueAndValidity();
      this.offerForm.get("descriptionAr")?.updateValueAndValidity();
      this.offerForm.get("instructionsEn")?.updateValueAndValidity();
      this.offerForm.get("instructionsAr")?.updateValueAndValidity();
      this.offerForm.get("offerImage")?.updateValueAndValidity();
      this.offerForm.get("offerImageLandscape")?.updateValueAndValidity();
    }

    this.offerForm.get("highlightImage")?.addValidators(Validators.required);
    this.offerForm.get("highlightImageLandscape")?.addValidators(
      Validators.required,
    );
    this.offerForm.get("highlightImage")?.updateValueAndValidity({
      emitEvent: false,
    });
    this.offerForm.get("highlightImageLandscape")?.updateValueAndValidity({
      emitEvent: false,
    });

    const highlightControl = this.offerForm.get("highlight");
    this.syncHighlightValidators(!!highlightControl?.value);
    highlightControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.syncHighlightValidators(!!value);
      });

    const vendorControl = this.offerForm.get("selectedVendor");
    vendorControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vendorId) => {
        this.ensureSelectedVendorLoaded(vendorId);
        this.onVendorChange(vendorId);
      });
    if (vendorControl?.value) {
      this.ensureSelectedVendorLoaded(vendorControl.value);
      this.onVendorChange(vendorControl.value);
    }

    const modeControl = this.offerForm.get("mode");
    this.updateWebsiteValidator(
      modeControl?.value as
      | "In-Store"
      | "Digital"
      | "In-Store & Digital"
      | null,
    );
    modeControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        this.updateWebsiteValidator(
          mode as "In-Store" | "Digital" | "In-Store & Digital" | null,
        );
        this.syncAutoTagsForMode(
          mode as "In-Store" | "Digital" | "In-Store & Digital" | null,
        );
      });
    if (!isEdit) {
      this.syncAutoTagsForMode(
        modeControl?.value as
        | "In-Store"
        | "Digital"
        | "In-Store & Digital"
        | null,
      );
    }

    const discountTypeControl = this.offerForm.get("discountType");
    this.updateDiscountAmountValidators(
      discountTypeControl?.value as "Fixed" | "Percentage" | "Others" | null,
    );
    discountTypeControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((discountType) => {
        this.updateDiscountAmountValidators(
          discountType as "Fixed" | "Percentage" | "Others" | null,
        );
        if (discountType === "Others") {
          this.sanitizeArabicInput("discountAr");
        } else {
          this.sanitizeDiscountInput("discountEn");
          this.sanitizeDiscountInput("discountAr");
        }
      });

    const categoryControl = this.offerForm.get("category");
    categoryControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateHotelDetailsValidators());

    // Re-validate expiry when startdate changes and update minExpiryDate
    this.offerForm
      .get("startdate")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        if (val) {
          const d = new Date(val);
          d.setDate(d.getDate() + 2);
          this.minExpiryDate.set(d);
        } else {
          this.minExpiryDate.set(this.minDate);
        }
        this.offerForm.get("expiry")?.updateValueAndValidity();
      });

    // Initialize minExpiryDate if startdate has a value
    const initialStart = this.offerForm.get("startdate")?.value;
    if (initialStart) {
      const d = new Date(initialStart);
      d.setDate(d.getDate() + 2);
      this.minExpiryDate.set(d);
    }

    // In edit mode, any value change (including category, tags, etc.) should enable Save.
    // markAsDirty() alone is invisible to zoneless change detection, so also flip the signal
    // hasEditChanges()/the Save-Draft & Update buttons actually read.
    if (isEdit) {
      this.offerForm.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Ignore our own programmatic patches (initial load, async location fetch),
          // otherwise the form looks edited before the user has touched anything.
          if (this.suppressDirtyTracking) {
            return;
          }
          this.offerForm.markAsDirty();
          this.hasUnsavedEditChanges.set(true);
        });
    }

    this.offerForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.formPreviewValue.set(value));

    this.offerForm
      .get("tagInput")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const tagName = typeof value === "string" ? value : (value?.name ?? "");
        if (!tagName.trim()) {
          this.tagDuplicateError.set(false);
          return;
        }
        this.updateTagDuplicateState(tagName);
      });

    effect(
      () => {
        const action = this.actionType();
        const data = this.editableFormData();
        if (action !== "edit" || !data || Object.keys(data).length === 0) {
          return;
        }
        const id =
          typeof (data as any)?._id === "string"
            ? (data as any)._id
            : typeof (data as any)?._id?.$oid === "string"
              ? (data as any)._id.$oid
              : null;
        const sameOffer = id != null && id === this.lastPatchedOfferId;
        // Read the dirty state and patch the form untracked: `hasEditChanges()` reads
        // `hasUnsavedEditChanges`, which `mapOfferToForm` writes (directly, and via the
        // `valueChanges` subscription that `patchValue` fires). Tracking it here would
        // make this effect re-trigger itself on every run — an infinite loop that pegs
        // the main thread. This effect should only ever react to `editableFormData`.
        untracked(() => {
          if (sameOffer && this.hasEditChanges()) {
            return;
          }
          this.mapOfferToForm(data);
        });
      },
      { injector: this.injector },
    );
  }

  loadInitialData() {
    this.loadVendorOptions();
    this.getCategories();
    this.tagsListService.loadTags();
  }

  private setupVendorSearch(): void {
    this.vendorSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((searchTerm) => {
        this.loadVendorFirstPage(searchTerm);
      });
  }

  loadVendorOptions(searchTerm = ""): void {
    this.vendorSearch$.next(searchTerm.trim());
  }

  onVendorSearch(
    event: { filter?: string; query?: string } | null | undefined,
  ): void {
    const searchTerm = event?.filter ?? event?.query ?? "";
    this.loadVendorOptions(searchTerm);
  }

  private fetchVendorPage(page: number, searchTerm = "") {
    this.vendorsLoading.set(true);
    return of({
      data: [{
        _id: "dummy-vendor-id-12345",
        vendorName: "Dummy Vendor (Mocked)",
        status: "Active",
        categories: [],
        locations: []
      }] as unknown as VendorDetails[],
      total: 1,
      page: 1,
      pageSize: 10
    }).pipe(
      finalize(() => this.vendorsLoading.set(false))
    );
  }

  private resetVendorSearchResults(searchTerm: string): void {
    this.vendorSearchTerm = searchTerm;
    this.vendorCurrentPage = 0;
    this.vendorTotalRecords = 0;
    this.vendorsHasMore.set(false);
    this.setVendorOptions([]);
  }

  private loadVendorFirstPage(searchTerm = ""): void {
    this.resetVendorSearchResults(searchTerm);
    this.fetchVendorPage(1, searchTerm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.vendorCurrentPage = response.page;
        this.vendorTotalRecords = response.total;
        this.setVendorOptions(response.data);
        this.resetVendorDropdownScrollPosition();
      });
  }

  private loadMoreVendors(): void {
    if (this.vendorsLoading() || !this.vendorsHasMore()) {
      return;
    }

    const nextPage = this.vendorCurrentPage + 1;
    this.fetchVendorPage(nextPage, this.vendorSearchTerm)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.vendorCurrentPage = response.page;
        this.vendorTotalRecords = response.total;
        this.setVendorOptions([...this.vendors(), ...response.data]);
      });
  }

  private setVendorOptions(vendors: VendorDetails[]): void {
    const dedupedVendors = vendors.filter((vendor, index, source) => {
      const vendorId = String(vendor?._id?.$oid ?? vendor?._id ?? "");
      return (
        !!vendorId &&
        source.findIndex(
          (candidate) =>
            String(candidate?._id?.$oid ?? candidate?._id ?? "") === vendorId,
        ) === index
      );
    });

    const selectedVendor = this.selectedVendorDetails();
    if (!selectedVendor) {
      this.vendors.set(dedupedVendors);
      this.vendorsHasMore.set(dedupedVendors.length < this.vendorTotalRecords);
      return;
    }

    const selectedVendorId = String(
      selectedVendor?._id?.$oid ?? selectedVendor?._id ?? "",
    );
    const includesSelectedVendor = dedupedVendors.some(
      (vendor) =>
        String(vendor?._id?.$oid ?? vendor?._id ?? "") === selectedVendorId,
    );

    this.vendors.set(
      includesSelectedVendor
        ? dedupedVendors
        : [selectedVendor, ...dedupedVendors],
    );
    this.vendorsHasMore.set(dedupedVendors.length < this.vendorTotalRecords);
  }

  onVendorDropdownShow(): void {
    queueMicrotask(() => this.attachVendorDropdownScrollListener());
  }

  onVendorDropdownHide(): void {
    this.detachVendorDropdownScrollListener();
  }

  private attachVendorDropdownScrollListener(): void {
    this.detachVendorDropdownScrollListener();
    const listContainer = this.document.querySelector(
      '.offer-form-vendor-select-panel [data-pc-section="listcontainer"]',
    ) as HTMLElement | null;
    if (!listContainer) {
      return;
    }

    this.vendorDropdownScrollElement = listContainer;
    this.vendorDropdownScrollElement.addEventListener(
      "scroll",
      this.handleVendorDropdownScroll,
      { passive: true },
    );
  }

  private detachVendorDropdownScrollListener(): void {
    if (!this.vendorDropdownScrollElement) {
      return;
    }

    this.vendorDropdownScrollElement.removeEventListener(
      "scroll",
      this.handleVendorDropdownScroll,
    );
    this.vendorDropdownScrollElement = null;
  }

  private readonly handleVendorDropdownScroll = (): void => {
    const container = this.vendorDropdownScrollElement;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom <= this.vendorScrollThresholdPx) {
      this.loadMoreVendors();
    }
  };

  private resetVendorDropdownScrollPosition(): void {
    if (this.vendorDropdownScrollElement) {
      this.vendorDropdownScrollElement.scrollTop = 0;
    }
  }

  private ensureSelectedVendorLoaded(vendorId: string | null): void {
    if (!vendorId) {
      this.selectedVendorDetails.set(null);
      return;
    }

    const existingVendor = this.vendors().find(
      (vendor) => String(vendor?._id?.$oid ?? vendor?._id ?? "") === vendorId,
    );
    if (existingVendor) {
      this.selectedVendorDetails.set(existingVendor);
      return;
    }

    this.vendorById
      .getVendorById(vendorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vendor) => {
          this.selectedVendorDetails.set(vendor);
          this.setVendorOptions(this.vendors());
        },
        error: (err) => {
          console.error("Selected vendor fetch error:", err);
        },
      });
  }

  getCategories() {
    this.categoriesLoading.set(true);
    this.categoriesService.getAllCategories().subscribe({
      next: (res) => {
        const activeCategories = (res || []).filter(
          (cat) => cat.isActive !== false,
        );
        this.categories.set(activeCategories);
        this.updateHotelDetailsValidators();
        this.categoriesLoading.set(false);
      },
      error: (err) => {
        console.error("Category fetch error:", err);
        this.categories.set([]);
        this.categoriesLoading.set(false);
      },
    });
  }

  showHotelDetails() {
    const selectedCategoryIds = this.offerForm.get("category")?.value as
      | string[]
      | null;
    if (!selectedCategoryIds || selectedCategoryIds.length === 0) {
      return false;
    }

    return this.categories().some((category) => {
      const id =
        typeof category._id === "string" ? category._id : category._id?.$oid;
      return (
        typeof id === "string" &&
        selectedCategoryIds.includes(id) &&
        category.name?.trim().toLowerCase() === "hotels"
      );
    });
  }

  onVendorChange(vendorId: string | null) {
    this.vendorLocations.set([]);
    this.patchWithoutDirty(() => this.offerForm.patchValue({ locationIds: [] }));

    if (!vendorId) {
      return;
    }

    this.locationsLoading.set(true);
    this.vendorlist
      .getVendorLocationsById(vendorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any[]) => {
          const options = (res || [])
            .map((loc: any) => ({
              id: loc?.__id__?.$oid ?? "",
              label:
                loc?.branch_name || loc?.city || loc?.address || "Location",
              branch_name_ar: loc?.branch_name_ar || "",
              address: loc?.address,
              address_ar: loc?.address_ar || "",
              city: loc?.city,
              city_ar: loc?.city_ar || "",
            }))
            .filter((opt) => !!opt.id);

          this.vendorLocations.set(options);

          const current = this.offerForm.get("locationIds")?.value as
            | string[]
            | null;
          const nextSelectedIds = Array.isArray(current)
            ? current.filter((id) => options.some((option) => option.id === id))
            : [];
          this.patchWithoutDirty(() =>
            this.offerForm.patchValue({ locationIds: nextSelectedIds }),
          );

          this.locationsLoading.set(false);
        },
        error: (err) => {
          console.error("Vendor locations fetch error:", err);
          this.locationsLoading.set(false);
        },
      });
  }

  /**
   * Validation order for toast messaging (first invalid field wins).
   * Matches create-mode required validators and highlight block when enabled.
   */
  private getValidationOrder(): Array<{ path: string; label: string }> {
    const order: Array<{ path: string; label: string }> = [
      { path: "selectedVendor", label: "offerForm.field.vendor" },
      { path: "titleEn", label: "offerForm.field.titleEn" },
      { path: "titleAr", label: "offerForm.field.titleAr" },
      { path: "descriptionEn", label: "offerForm.field.descriptionEn" },
      { path: "descriptionAr", label: "offerForm.field.descriptionAr" },
      { path: "discountType", label: "offerForm.field.discountType" },
      { path: "startdate", label: "offerForm.field.startDate" },
      { path: "expiry", label: "offerForm.field.expiryDate" },
      { path: "category", label: "offerForm.field.category" },
      ...(this.showHotelDetails()
        ? [
          { path: "taxValue", label: "offerForm.field.taxValueEn" },
          { path: "taxValueAr", label: "offerForm.field.taxValueAr" },
          { path: "currency", label: "offerForm.field.currency" },
          { path: "hotelAmenities", label: "offerForm.field.amenities" },
          { path: "hotelAmenitiesAr", label: "offerForm.field.amenitiesAr" },
        ]
        : []),
      { path: "instructionsEn", label: "offerForm.field.instructionsEn" },
      { path: "instructionsAr", label: "offerForm.field.instructionsAr" },
      { path: "mode", label: "offerForm.field.offerType" },
      { path: "urlLink", label: "offerForm.field.website" },
      { path: "discountEn", label: "offerForm.field.discountEn" },
      { path: "discountAr", label: "offerForm.field.discountAr" },
      { path: "phone", label: "offerForm.field.phone1" },
      { path: "landline", label: "offerForm.field.phone2" },
      { path: "email", label: "offerForm.field.email" },
      { path: "locationIds", label: "offerForm.field.locations" },
      { path: "offerImage", label: "offerForm.field.offerImageMobile" },
      { path: "offerImageLandscape", label: "offerForm.field.offerImageDesktop" },
    ];
    if (this.highlightEnabled()) {
      order.push(
        { path: "highlightImage", label: "offerForm.field.highlightImageMobile" },
        { path: "highlightImageLandscape", label: "offerForm.field.highlightImageDesktop" },
        { path: "highlightTitleEn", label: "offerForm.field.highlightTitleEn" },
        { path: "highlightTitleAr", label: "offerForm.field.highlightTitleAr" },
        {
          path: "highlightDescription",
          label: "offerForm.field.highlightDescEn",
        },
        {
          path: "highlightDescriptionAr",
          label: "offerForm.field.highlightDescAr",
        },
      );
    }
    return order;
  }

  private updateWebsiteValidator(
    mode: "In-Store" | "Digital" | "In-Store & Digital" | null,
  ) {
    const urlControl = this.offerForm.get("urlLink");
    const discountCodeControl = this.offerForm.get("discountCode");
    const locationIdsControl = this.offerForm.get("locationIds");
    if (!urlControl || !discountCodeControl || !locationIdsControl) return;

    if (mode === "Digital" || mode === "In-Store & Digital") {
      urlControl.addValidators(Validators.required);
    } else {
      urlControl.removeValidators(Validators.required);
    }

    if (mode === "Digital") {
      locationIdsControl.removeValidators(Validators.required);
    } else {
      locationIdsControl.addValidators(Validators.required);
    }

    urlControl.updateValueAndValidity({ emitEvent: false });
    discountCodeControl.updateValueAndValidity({ emitEvent: false });
    locationIdsControl.updateValueAndValidity({ emitEvent: false });
  }

  private updateHotelDetailsValidators() {
    const shouldRequireHotelDetails = this.showHotelDetails();

    for (const name of this.hotelRequiredControlNames) {
      const control = this.offerForm.get(name);
      if (!control) continue;

      if (shouldRequireHotelDetails) {
        control.addValidators(Validators.required);
      } else {
        control.removeValidators(Validators.required);
      }

      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private syncHighlightValidators(enabled: boolean): void {
    this.highlightEnabled.set(enabled);

    const highlightRequiredControls = [
      "highlightTitleEn",
      "highlightTitleAr",
      "highlightDescription",
      "highlightDescriptionAr",
    ] as const;

    for (const name of highlightRequiredControls) {
      const ctrl = this.offerForm.get(name);
      if (!ctrl) continue;

      if (enabled) {
        ctrl.addValidators(Validators.required);
      } else {
        ctrl.removeValidators(Validators.required);
      }

      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  private getFirstMissingInOrder(): {
    control: FormControl;
    label: string;
  } | null {
    // First, check the ordered list for a specific sequence
    for (const { path, label } of this.getValidationOrder()) {
      const control = this.offerForm.get(path);
      if (control && control.invalid && control.errors) {
        return { control: control as FormControl, label };
      }
    }

    // Fallback: Check ALL controls in the form to ensure we don't show a generic message
    // if an invalid control exists but was missed in the order list.
    const findInvalid = (
      group: FormGroup | FormArray,
    ): { control: FormControl; label: string } | null => {
      for (const [name, control] of Object.entries(group.controls)) {
        if (control.invalid) {
          if (control instanceof FormControl) {
            return { control: control as FormControl, label: name };
          } else if (
            control instanceof FormGroup ||
            control instanceof FormArray
          ) {
            return findInvalid(control);
          }
        }
      }
      return null;
    };

    return findInvalid(this.offerForm);
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.offerForm.get(controlName);
    return !!control?.touched && control.hasError("required");
  }

  hasFieldError(controlName: string, errorName: string): boolean {
    const control = this.offerForm.get(controlName);
    return !!control?.touched && control.hasError(errorName);
  }

  hasDiscountNumericError(controlName: "discountEn" | "discountAr"): boolean {
    const control = this.offerForm.get(controlName);
    return !!control?.touched && control.hasError("numericDiscount");
  }

  hasDiscountPercentageRangeError(
    controlName: "discountEn" | "discountAr",
  ): boolean {
    const control = this.offerForm.get(controlName);
    return !!control?.touched && control.hasError("percentageRange");
  }

  requiresBranchSelection(): boolean {
    const mode = this.offerForm.get("mode")?.value;
    return mode === "In-Store" || mode === "In-Store & Digital";
  }

  selectedBranchCount(): number {
    const value = this.offerForm.get("locationIds")?.value;
    return Array.isArray(value)
      ? value.filter(
        (id: unknown) => typeof id === "string" && id.trim() !== "",
      ).length
      : 0;
  }

  hasVendorBranches(): boolean {
    return this.vendorLocations().length > 0;
  }

  isBranchSelectionDisabled(): boolean {
    return (
      !this.offerForm.get("selectedVendor")?.value ||
      this.locationsLoading() ||
      !this.hasVendorBranches()
    );
  }

  showVendorHasNoBranchesMessage(): boolean {
    return (
      !!this.offerForm.get("selectedVendor")?.value &&
      this.requiresBranchSelection() &&
      !this.locationsLoading() &&
      !this.hasVendorBranches()
    );
  }

  showBranchSelectionRequiredMessage(): boolean {
    return (
      !!this.offerForm.get("selectedVendor")?.value &&
      this.requiresBranchSelection() &&
      !this.locationsLoading() &&
      this.hasVendorBranches() &&
      this.selectedBranchCount() === 0
    );
  }

  hasBranchActivationIssue(): boolean {
    return (
      this.showVendorHasNoBranchesMessage() ||
      this.showBranchSelectionRequiredMessage()
    );
  }

  getBranchActivationMessage(): string {
    if (this.showVendorHasNoBranchesMessage()) {
      return this.i18n.t("offerForm.location.noBranches");
    }

    if (this.showBranchSelectionRequiredMessage()) {
      return this.i18n.t("offerForm.location.selectRequired");
    }

    return "";
  }

  isSubmitDisabled(): boolean {
    if (this.actionType() === "edit" && !this.hasEditChanges()) {
      return true;
    }

    return this.isSubmitting() || this.hasBranchActivationIssue();
  }

  private expiryDateValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!this.offerForm) return null;

    const start = this.offerForm.get("startdate")?.value;
    const end = control.value;

    if (!start || !end) return null;

    const startDate = new Date(start);
    const expiryDate = new Date(end);

    // Normalize to midnight to compare only dates
    startDate.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const diffInMs = expiryDate.getTime() - startDate.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

    // "At least one day between" implies Expiry Date - Start Date >= 2 days
    // e.g., Start: May 1, Gap: May 2, Expiry: May 3 (Diff = 2 days)
    if (diffInDays < 2) {
      return { invalidDateRange: true };
    }

    return null;
  };

  submit() {
    if (this.isSubmitting()) return;

    this.syncAutoTagsForCurrentMode();

    if (this.actionType() === "edit" && !this.hasEditChanges()) {
      this.messageService.add({
        severity: "info",
        summary: this.i18n.t("offerForm.toast.noChangesSummary"),
        detail: this.i18n.t("offerForm.toast.noChangesDetail"),
        life: 2500,
      });
      return;
    }

    if (this.hasBranchActivationIssue()) {
      this.offerForm.get("locationIds")?.markAsTouched();
      this.offerForm.get("locationIds")?.markAsDirty();
      this.messageService.add({
        severity: "warn",
        summary: this.i18n.t("offerForm.toast.cannotActivateSummary"),
        detail: this.getBranchActivationMessage(),
        life: 5000,
      });
      return;
    }

    if (this.offerForm.invalid) {
      const first = this.getFirstMissingInOrder();
      if (first) {
        first.control.markAsTouched();
        first.control.markAsDirty();
        const isRequired = !!first.control.errors?.["required"];
        this.messageService.add({
          severity: "warn",
          summary: this.i18n.t(
            isRequired
              ? "offerForm.toast.missingFieldSummary"
              : "offerForm.toast.invalidFieldSummary",
          ),
          detail: this.i18n.t(
            isRequired
              ? "offerForm.toast.missingFieldDetail"
              : "offerForm.toast.invalidFieldDetail",
            { field: this.i18n.t(first.label) },
          ),
          life: 5000,
        });
      } else {
        this.messageService.add({
          severity: "warn",
          summary: this.i18n.t("offerForm.toast.missingFieldsSummary"),
          detail: this.i18n.t("offerForm.toast.missingFieldsDetail"),
          life: 5000,
        });
      }
      this.markFormGroupTouched(this.offerForm);
      return;
    }

    const selectedVendor = this.getSelectedVendor();
    if (isVendorInactive(selectedVendor)) {
      this.messageService.add({
        severity: "warn",
        summary: this.i18n.t("offerForm.toast.vendorInactiveSummary"),
        detail: this.i18n.t("offerForm.toast.vendorInactiveDetail"),
        life: 3500,
      });
      return;
    }

    this.showConfirmationDialog.set(true);
  }

  private getSelectedVendor(): VendorDetails | null {
    const selectedVendorId = this.offerForm.get("selectedVendor")?.value;
    if (!selectedVendorId) {
      return null;
    }

    return (
      this.vendors().find(
        (vendor) =>
          String(vendor?._id?.$oid ?? vendor?._id ?? "") === selectedVendorId,
      ) ?? this.selectedVendorDetails()
    );
  }

  /**
   * Package the current form for the parent: the full payload, plus the diff against the
   * loaded offer. In create mode there is no baseline, so every field counts as changed.
   */
  private buildSubmitEvent(): OfferFormSubmit {
    const payload = this.mapFormToPayload(this.offerForm.value);
    return {
      payload,
      changedFields:
        this.actionType() === "edit"
          ? getChangedOfferFields(this.editBaselinePayload, payload)
          : { ...(payload as unknown as Record<string, unknown>) },
    };
  }

  onSaveDraft() {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.saveDraftEvent.emit(this.buildSubmitEvent());

    // Safety timeout in case parent doesn't navigate away
    setTimeout(() => this.isSubmitting.set(false), 1000);
  }

  onConfirmSubmit() {
    if (this.isSubmitting()) return;

    this.showConfirmationDialog.set(false);
    this.isSubmitting.set(true);

    this.submitOfferFormEvent.emit(this.buildSubmitEvent());

    // Reset isSubmitting after a delay or on event completion if managed by parent
    // For now, we'll let the parent navigation or error handling reset it if needed,
    // but adding a safety timeout here.
    setTimeout(() => this.isSubmitting.set(false), 5000);
  }

  onCancelSubmit() {
    this.showConfirmationDialog.set(false);
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      control.markAsDirty();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }

      if (control instanceof FormArray) {
        control.controls.forEach((ctrl) => {
          ctrl.markAsTouched();
          ctrl.markAsDirty();
        });
      }
    });
  }

  sanitizePhoneInput(controlName: "phone" | "landline") {
    const control = this.offerForm.get(controlName);
    const currentValue = control?.value;

    if (typeof currentValue !== "string") {
      return;
    }

    const sanitizedValue = currentValue.replace(/[^0-9+() ]/g, "");
    if (sanitizedValue !== currentValue) {
      control?.setValue(sanitizedValue);
      if (controlName === "phone") this.phoneError.set(true);
      else this.landlineError.set(true);
    } else {
      if (controlName === "phone") this.phoneError.set(false);
      else this.landlineError.set(false);
    }
  }

  sanitizeArabicInput(controlName: string) {
    // Arabic-only input sanitizing disabled.
    return;
  }

  sanitizeDiscountInput(controlName: "discountEn" | "discountAr") {
    if (!this.requiresNumericDiscount()) {
      return;
    }

    const control = this.offerForm.get(controlName);
    const currentValue = control?.value;

    if (typeof currentValue !== "string") {
      return;
    }

    const sanitizedValue = this.normalizeDiscountInput(currentValue);
    if (sanitizedValue !== currentValue) {
      control?.setValue(sanitizedValue);
    }
  }

  private optionalPhoneValidator(
    control: AbstractControl,
  ): ValidationErrors | null {
    const value = control.value;

    if (value == null || value === "") {
      return null;
    }

    if (typeof value !== "string") {
      return { invalidPhone: true };
    }

    const trimmedValue = value.trim();
    const digitsOnly = trimmedValue.replace(/\D/g, "");

    if (!this.phonePattern.test(trimmedValue) || digitsOnly.length < 7) {
      return { invalidPhone: true };
    }

    return null;
  }

  private updateDiscountAmountValidators(
    discountType: "Fixed" | "Percentage" | "Others" | null,
  ) {
    const discountEnControl = this.offerForm.get("discountEn");
    const discountArControl = this.offerForm.get("discountAr");
    const numericDiscount = this.isNumericDiscountType(discountType);
    const isOthers = discountType === "Others";

    if (discountEnControl) {
      discountEnControl.clearValidators();
      const enValidators: any[] = [Validators.required];
      if (numericDiscount) {
        enValidators.push(this.discountEnNumericValidator);
      }
      discountEnControl.setValidators(enValidators);
      discountEnControl.updateValueAndValidity({ emitEvent: false });
    }

    if (discountArControl) {
      discountArControl.clearValidators();
      const arValidators: any[] = [];
      if (numericDiscount) {
        arValidators.push(this.discountArNumericValidator);
      } else if (isOthers) {
        arValidators.push(
          Validators.required,
          // arabicOnlyValidator(), // Arabic-only validation disabled
        );
      }
      discountArControl.setValidators(arValidators);
      discountArControl.updateValueAndValidity({ emitEvent: false });
    }
  }

  private validateNumericDiscount(
    control: AbstractControl,
  ): ValidationErrors | null {
    if (!this.requiresNumericDiscount()) {
      return null;
    }

    const value = control.value;
    if (value == null || value === "") {
      return null;
    }

    if (typeof value !== "string") {
      return { numericDiscount: true };
    }

    const normalizedValue = this.normalizeDiscountValueForValidation(value);
    if (
      !normalizedValue ||
      !this.discountNumericPattern.test(normalizedValue)
    ) {
      return { numericDiscount: true };
    }

    if (this.offerForm.get("discountType")?.value === "Percentage") {
      const numericValue = Number(normalizedValue.replace(",", "."));
      if (
        !Number.isFinite(numericValue) ||
        numericValue < 0 ||
        numericValue > 100
      ) {
        return { percentageRange: true };
      }
    }

    return null;
  }

  private isNumericDiscountType(
    discountType: "Fixed" | "Percentage" | "Others" | null,
  ): boolean {
    return discountType === "Fixed" || discountType === "Percentage";
  }

  private requiresNumericDiscount(): boolean {
    return this.isNumericDiscountType(
      this.offerForm.get("discountType")?.value as
      | "Fixed"
      | "Percentage"
      | "Others"
      | null,
    );
  }

  private normalizeDiscountInput(value: string): string {
    const westernized = value
      .replace(/[\u0660-\u0669]/g, (digit) =>
        String(digit.charCodeAt(0) - 0x0660),
      )
      .replace(/[\u06F0-\u06F9]/g, (digit) =>
        String(digit.charCodeAt(0) - 0x06f0),
      )
      .replace(/\u066B/g, ".")
      .replace(/\u066C/g, ",");

    let result = "";
    let hasSeparator = false;

    for (const char of westernized) {
      if (/\d/.test(char)) {
        result += char;
        continue;
      }

      if ((char === "." || char === ",") && !hasSeparator) {
        result += char;
        hasSeparator = true;
      }
    }

    return result;
  }

  private normalizeDiscountValueForValidation(value: string): string {
    return this.normalizeDiscountInput(value).trim();
  }

  getAddOfferIconPath(iconName: string): string {
    return resolveAssetUrl(this.document, `svg/Offers/add-offer/${iconName}`);
  }

  getOfferIconMask(iconName: string): string {
    return resolveMaskImageStyle(
      this.document,
      `svg/Offers/add-offer/${iconName}`,
    );
  }

  getUploadIconMask(): string {
    return resolveUploadIconMaskStyle(this.document);
  }

  mapOfferToForm(offerdetails: any) {
    // Convert Mongo date → JS Date
    const toDate = (d: any): Date | null => {
      if (!d) return null;
      if (d instanceof Date) return d;
      if (typeof d === "number") return new Date(d);
      if (typeof d === "string") {
        const parsed = new Date(d);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      if (d?.$date) {
        const parsed = new Date(d.$date);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    };

    // Convert "true"/"false" → boolean
    const toBool = (v: any) => v === true || v === "true";

    // Safely get first value from array/string/undefined
    const firstOrEmpty = (value: any): string => {
      if (Array.isArray(value)) {
        return (value[0] ?? "") as string;
      }
      return (value ?? "") as string;
    };

    // Convert API array/string → flat array (no [[]])
    const toFlatArray = (value: any): string[] => {
      if (!value || value === "") return [];
      if (Array.isArray(value)) return value.flat(); // prevents [[]]
      return [value];
    };

    const parseJsonIfString = (value: any) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (!trimmed) return value;
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    };

    const rawHotelDetails = parseJsonIfString(offerdetails?.hotel_details);
    const hotelDetails = rawHotelDetails ?? offerdetails;
    const roomDetailsRaw = parseJsonIfString(
      hotelDetails?.roomDetails ?? offerdetails?.roomDetails,
    );
    const roomDrafts = this.mapApiRoomsToDrafts(roomDetailsRaw);
    const roomsCount =
      roomDrafts.length ||
      this.normalizeRoomsCount(hotelDetails?.rooms ?? offerdetails?.rooms);
    this.highlightCropSourceByTab = { mobile: null, desktop: null };

    // Reset tags FormArray
    const tagsArray = this.offerForm.get("selectedTags") as FormArray;
    tagsArray.clear();

    const tags = Array.isArray(offerdetails.tags) ? offerdetails.tags : [];

    tags.forEach((t: string) => tagsArray.push(new FormControl(t)));

    const currentOfferImage = this.offerForm.get("offerImage")?.value;
    const userSelectedNewOfferImage = currentOfferImage instanceof File;
    const currentOfferLandscapeImage = this.offerForm.get(
      "offerImageLandscape",
    )?.value;
    const userSelectedNewOfferLandscapeImage =
      currentOfferLandscapeImage instanceof File;
    const currentHighlightImage = this.offerForm.get("highlightImage")?.value;
    const userSelectedNewHighlightImage = currentHighlightImage instanceof File;
    const currentHighlightLandscapeImage = this.offerForm.get(
      "highlightImageLandscape",
    )?.value;
    const userSelectedNewHighlightLandscapeImage =
      currentHighlightLandscapeImage instanceof File;

    const patch: Record<string, unknown> = {
      selectedVendor:
        offerdetails.vendor?._id?.$oid ?? offerdetails.vendorId ?? "",

      titleEn: offerdetails.title ?? "",
      titleAr: offerdetails.title_ar ?? "",

      descriptionEn: offerdetails.description ?? "",
      descriptionAr: offerdetails.description_ar ?? "",

      discountEn:
        offerdetails.discount_amount ?? offerdetails.Discount_amount ?? "",
      discountAr:
        offerdetails.discount_amount_ar ??
        offerdetails.Discount_amount_ar ??
        "",
      discountCode: offerdetails.discountCode ?? "",

      startdate: toDate(
        offerdetails.startDate ??
        offerdetails.start_date ??
        offerdetails.startdate,
      ),
      expiry: toDate(
        offerdetails.expiryDate ??
        offerdetails.expiry_date ??
        offerdetails.expiry,
      ),

      category: this.normalizeCategoryIds(offerdetails),

      targetAudience: Array.isArray(offerdetails?.targetAudience)
        ? offerdetails.targetAudience.filter(
          (v: unknown) => typeof v === "string" && v.trim() !== "",
        )
        : [],

      tagInput: "",

      instructionsEn: offerdetails.howToAvail ?? "",
      instructionsAr: offerdetails.howToAvail_ar ?? "",

      urlLink: offerdetails.discount_url ?? offerdetails.website ?? "",
      storeWebsiteLink: offerdetails.website ?? "",

      mode: mapOfferModeToFormMode(offerdetails.offerMode),

      hotelRating: toBool(
        hotelDetails?.hotelStarRating ?? offerdetails.hotelStarRating,
      )
        ? "Yes"
        : "No",

      // Contact information – supports both string and array from API
      phone: firstOrEmpty(offerdetails.mobile),
      email: firstOrEmpty(offerdetails.email),
      landline: firstOrEmpty(offerdetails.telephone),

      highlight: toBool(
        offerdetails.isHighlightEnabled ?? offerdetails.isFeatured,
      ),

      discountType:
        offerdetails.discountType === "fixed"
          ? "Fixed"
          : offerdetails.discountType === "percentage"
            ? "Percentage"
            : "Others",
      taxValue: hotelDetails?.taxValue ?? offerdetails.taxValue ?? "",
      taxValueAr: hotelDetails?.taxValue_ar ?? offerdetails.taxValue_ar ?? "",
      currency: hotelDetails?.currency ?? offerdetails.currency ?? "",
      hotelAmenities: Array.isArray(hotelDetails?.hotelAmenitites)
        ? hotelDetails.hotelAmenitites.join(", ")
        : (hotelDetails?.hotelAmenitites ?? hotelDetails?.hotelAmenities ?? ""),
      hotelAmenitiesAr: Array.isArray(hotelDetails?.hotelAmenitites_ar)
        ? hotelDetails.hotelAmenitites_ar.join(", ")
        : (hotelDetails?.hotelAmenitites_ar ?? ""),
      rooms: roomsCount,

      // Use separate highlight fields only. Falling back to the offer description here
      // makes disabled/re-enabled custom highlights show the wrong description.
      highlightTitleEn:
        offerdetails.highlight_title ?? offerdetails.highlights ?? "",
      highlightTitleAr:
        offerdetails.highlight_title_ar ?? offerdetails.highlights_ar ?? "",
      highlightDescription: offerdetails.highlight_description ?? "",
      highlightDescriptionAr: offerdetails.highlight_description_ar ?? "",
    };

    if (!userSelectedNewOfferImage) {
      patch["offerImage"] = offerdetails.image ?? null;
      if (typeof patch["offerImage"] === "string") {
        this.previewUrl.set(null);
        this.selectedOfferFileName.set(null);
      }
    }

    if (!userSelectedNewOfferLandscapeImage) {
      patch["offerImageLandscape"] =
        offerdetails.image_landscape ??
        offerdetails.coverImageLandscape ??
        offerdetails.image ??
        null;
      if (typeof patch["offerImageLandscape"] === "string") {
        this.offerLandscapePreviewUrl.set(null);
        this.selectedOfferLandscapeFileName.set(null);
      }
    }

    if (!userSelectedNewHighlightImage) {
      patch["highlightImage"] =
        offerdetails.highlight_image ?? offerdetails.featuredImage ?? null;
      if (typeof patch["highlightImage"] === "string") {
        this.highlightPreviewUrl.set(null);
        this.selectedHighlightFileName.set(null);
      }
    }

    if (!userSelectedNewHighlightLandscapeImage) {
      patch["highlightImageLandscape"] =
        offerdetails.highlight_image_landscape ??
        offerdetails.featuredImageLandscape ??
        null;
      if (typeof patch["highlightImageLandscape"] === "string") {
        this.highlightLandscapePreviewUrl.set(null);
        this.selectedHighlightLandscapeFileName.set(null);
      }
    }

    this.offerForm.patchValue(patch);
    this.initializeAutoManagedTagsForMode(
      patch["mode"] as "In-Store" | "Digital" | "In-Store & Digital" | null,
    );

    this.updateHotelDetailsValidators();

    const locationIds: string[] = Array.isArray(offerdetails.locationIds)
      ? offerdetails.locationIds.filter(
        (id: unknown) =>
          typeof id === "string" && (id as string).trim() !== "",
      )
      : [];
    this.offerForm.patchValue({
      locationIds,
    });

    this.roomItems.set(
      roomDrafts.length
        ? roomDrafts
        : roomsCount
          ? Array.from({ length: roomsCount }, (_, index) =>
            this.createPlaceholderRoom(index),
          )
          : [],
    );

    const hasPendingImageUpload =
      this.offerForm.get("offerImage")?.value instanceof File ||
      this.offerForm.get("offerImageLandscape")?.value instanceof File ||
      this.offerForm.get("highlightImage")?.value instanceof File ||
      this.offerForm.get("highlightImageLandscape")?.value instanceof File;
    if (!hasPendingImageUpload) {
      this.offerForm.markAsPristine();
      this.hasUnsavedEditChanges.set(false);
      // Snapshot the loaded offer while the form is still pristine — this is what save-time
      // diffs compare against.
      this.editBaselinePayload = this.mapFormToPayload(this.offerForm.value);
    }
    this.formPreviewValue.set(this.offerForm.getRawValue());

    const offerId =
      typeof offerdetails?._id === "string"
        ? offerdetails._id
        : typeof offerdetails?._id?.$oid === "string"
          ? offerdetails._id.$oid
          : null;
    if (offerId) {
      this.lastPatchedOfferId = offerId;
    }
  }

  backNavigation() {
    const route = this.backNavRouteLink();
    if (route) {
      this.router.navigate([route]);
    }
  }
  addTag() {
    const value = this.offerForm.get("tagInput")?.value;
    if (!value) return;

    const tagName = typeof value === "string" ? value : value.name;
    if (!tagName) return;

    const normalized = normalizeTagName(tagName);
    if (!normalized) return;

    this.tagInputTouched.set(true);
    this.updateTagDuplicateState();

    const existingGlobalTag = this.findKnownTagName(tagName);
    const existingSelectedTag = this.findSelectedTagName(tagName);

    if (existingSelectedTag) {
      this.offerForm.get("tagInput")?.reset();
      this.tagDuplicateError.set(false);
      this.tagInputTouched.set(false);
      return;
    }

    if (existingGlobalTag) {
      this.addExistingTag(existingGlobalTag);
      this.offerForm.get("tagInput")?.reset();
      this.tagDuplicateError.set(false);
      this.tagInputTouched.set(false);
      return;
    }

    // Since the user can only select existing tags, if it's not a known tag, we just reset.
    this.offerForm.get("tagInput")?.reset();
    this.tagDuplicateError.set(false);
    this.tagInputTouched.set(false);
  }

  addExistingTag(tagName: string) {
    if (!tagName) return;
    const currentTags = this.selectedTags.value as string[];
    const normalized = normalizeTagName(tagName);
    if (currentTags.some((tag) => normalizeTagName(tag) === normalized)) return;

    this.selectedTags.push(new FormControl(tagName.trim()));
  }

  onTagInputBlur() {
    this.tagInputTouched.set(true);
    this.updateTagDuplicateState();
  }

  shouldShowTagDuplicateError(): boolean {
    return this.tagInputTouched() && this.tagDuplicateError();
  }

  isTagAddDisabled(): boolean {
    const value = this.offerForm.get("tagInput")?.value;
    const tagName = typeof value === "string" ? value : (value?.name ?? "");
    return !tagName.trim() || !!this.findSelectedTagName(tagName);
  }

  searchTags(event: AutoCompleteCompleteEvent) {
    const query = event.query.toLowerCase();
    const all = this.tagsListService.tags().map((t) => t.name);
    this.suggestedTags.set(all.filter((t) => t.toLowerCase().includes(query)));
  }

  removeTag(index: number) {
    this.selectedTags.removeAt(index);
    this.updateTagDuplicateState();
  }

  private updateTagDuplicateState(rawValue?: string): void {
    const value =
      rawValue ??
      (() => {
        const current = this.offerForm.get("tagInput")?.value;
        return typeof current === "string" ? current : (current?.name ?? "");
      })();
    const normalized = normalizeTagName(value);
    if (!normalized) {
      this.tagDuplicateError.set(false);
      return;
    }

    this.tagDuplicateError.set(!!this.findSelectedTagName(value));
  }

  private findKnownTagName(value: string): string | null {
    const normalized = normalizeTagName(value);
    const tags = this.tagsListService.tags();
    const topTags = this.tagsListService.topTags();
    return (
      [...tags, ...topTags].find(
        (tag) => normalizeTagName(tag.name) === normalized,
      )?.name ?? null
    );
  }

  private findSelectedTagName(value: string): string | null {
    const normalized = normalizeTagName(value);
    const currentTags = this.selectedTags.value as string[];
    return (
      currentTags.find((tag) => normalizeTagName(tag) === normalized) ?? null
    );
  }

  private syncAutoTagsForMode(
    mode: "In-Store" | "Digital" | "In-Store & Digital" | null,
  ): void {
    this.replaceAutoManagedTags(this.getAutoTagsForMode(mode));
  }

  private syncAutoTagsForCurrentMode(): void {
    this.syncAutoTagsForMode(
      this.offerForm.get("mode")?.value as
        | "In-Store"
        | "Digital"
        | "In-Store & Digital"
        | null,
    );
  }

  private initializeAutoManagedTagsForMode(
    mode: "In-Store" | "Digital" | "In-Store & Digital" | null,
  ): void {
    const selectedTagNames = new Set(
      (this.selectedTags.value as string[]).map((tag) => normalizeTagName(tag)),
    );
    this.autoManagedTagNames = new Set(
      this.getAutoTagsForMode(mode)
        .map((tag) => normalizeTagName(tag))
        .filter((tag) => !!tag && selectedTagNames.has(tag)),
    );
  }

  private replaceAutoManagedTags(nextAutoTags: string[]): void {
    for (let index = this.selectedTags.length - 1; index >= 0; index -= 1) {
      const tagValue = this.selectedTags.at(index)?.value;
      const normalized = normalizeTagName(String(tagValue ?? ""));
      if (this.autoManagedTagNames.has(normalized)) {
        this.selectedTags.removeAt(index);
      }
    }

    nextAutoTags.forEach((tag) => this.addExistingTag(tag));
    this.autoManagedTagNames = new Set(
      nextAutoTags
        .map((tag) => normalizeTagName(tag))
        .filter((tag) => !!tag),
    );
    this.updateTagDuplicateState();
  }

  private getAutoTagsForMode(
    mode: "In-Store" | "Digital" | "In-Store & Digital" | null,
  ): string[] {
    if (mode === "Digital") {
      return ["digital", "online", "رقمي", "أونلاين"];
    }

    if (mode === "In-Store & Digital") {
      return [
        "in-store",
        "digital",
        "online",
        "في المتجر",
        "رقمي",
        "أونلاين",
      ];
    }

    if (mode === "In-Store") {
      return ["in-store", "في المتجر"];
    }

    return [];
  }

  private isDuplicateApiError(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse) || err.status !== 400) return false;
    const detail =
      typeof err.error === "string"
        ? err.error
        : `${err.error?.message ?? ""} ${err.error?.detail ?? ""} ${err.message ?? ""}`;
    return (
      detail.toLowerCase().includes("duplicate") ||
      detail.toLowerCase().includes("already exists")
    );
  }

  openRoomDialog(index?: number) {
    this.editingRoomIndex.set(index ?? null);
    this.showRoomDialog.set(true);
  }

  openLocationDialog() {
    const vendorId = this.offerForm.get("selectedVendor")?.value;
    if (!vendorId) {
      this.messageService.add({
        severity: "warn",
        summary: this.i18n.t("offerForm.toast.vendorRequiredSummary"),
        detail: this.i18n.t("offerForm.toast.vendorRequiredDetail"),
        life: 3000,
      });
      return;
    }
    this.showLocationDialog.set(true);
  }

  onRoomDialogVisibleChange(visible: boolean) {
    this.showRoomDialog.set(visible);
    if (!visible) {
      this.editingRoomIndex.set(null);
    }
  }

  onLocationDialogVisibleChange(visible: boolean) {
    this.showLocationDialog.set(visible);
  }

  onLocationAdded() {
    const vendorId = this.offerForm.get("selectedVendor")?.value;
    if (vendorId) {
      this.onVendorChange(vendorId);
    }
  }

  handleRoomSaved(room: OfferRoomDraft) {
    const editingIndex = this.editingRoomIndex();
    const nextRooms = [...this.roomItems()];

    if (
      editingIndex != null &&
      editingIndex >= 0 &&
      editingIndex < nextRooms.length
    ) {
      nextRooms[editingIndex] = room;
    } else {
      nextRooms.push(room);
    }

    this.roomItems.set(nextRooms);
    this.offerForm.patchValue({ rooms: nextRooms.length });
    this.offerForm.get("rooms")?.markAsDirty();
    this.editingRoomIndex.set(null);
  }

  removeRoom(index: number) {
    const nextRooms = this.roomItems().filter(
      (_, roomIndex) => roomIndex !== index,
    );
    this.roomItems.set(nextRooms);
    this.offerForm.patchValue({ rooms: nextRooms.length || null });
    this.offerForm.get("rooms")?.markAsDirty();
  }

  get selectedTags() {
    return this.offerForm.get("selectedTags") as FormArray;
  }

  get category() {
    return this.offerForm.get("category") as FormControl;
  }

  get targetAudience() {
    return this.offerForm.get("targetAudience") as FormControl<string[]>;
  }
  back() {
    this.router.navigate(["/offers"]);
  }

  onUpload(event: any) {
    const file: File = event.files[0];

    if (file) {
      this.setOfferImage(file);
    }
  }

  onHighlightFileUpload(event: any, tab: "mobile" | "desktop" = "mobile") {
    const file = event.files[0];

    if (file) {
      this.setHighlightImage(file, tab);
    }
  }

  private setOfferImage(file: File, input?: HTMLInputElement | null) {
    this.openCropper(
      "offer",
      file,
      input ?? this.offerFileInputRef?.nativeElement ?? null,
    );
  }

  private setHighlightImage(
    file: File,
    tab: "mobile" | "desktop",
    input?: HTMLInputElement | null,
  ) {
    this.openCropper(
      "highlight",
      file,
      input ?? this.getHighlightFileInputRef(tab) ?? null,
      tab,
    );
  }

  onOfferDragOver(event: DragEvent) {
    event.preventDefault();
    this.isOfferDragging.set(true);
  }

  onOfferDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isOfferDragging.set(false);
  }

  onOfferDrop(event: DragEvent) {
    event.preventDefault();
    this.isOfferDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.setOfferImage(files[0]);
    }
  }

  onOfferFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setOfferImage(file, input);
    }
  }

  removeOfferImage() {
    this.revokePreviewObjectUrl(this.previewUrl());
    this.previewUrl.set(null);
    this.selectedOfferFileName.set(null);
    this.offerForm.patchValue({ offerImage: null });
    this.offerForm.get("offerImage")?.markAsDirty();
    this.offerForm.get("offerImage")?.updateValueAndValidity();
    this.offerForm.markAsDirty();
    if (this.offerFileInputRef?.nativeElement) {
      this.offerFileInputRef.nativeElement.value = "";
    }
  }

  removeOfferLandscapeImage() {
    this.revokePreviewObjectUrl(this.offerLandscapePreviewUrl());
    this.offerLandscapePreviewUrl.set(null);
    this.selectedOfferLandscapeFileName.set(null);
    this.offerForm.patchValue({ offerImageLandscape: null });
    this.offerForm.get("offerImageLandscape")?.markAsDirty();
    this.offerForm.get("offerImageLandscape")?.updateValueAndValidity();
    this.offerForm.markAsDirty();
  }

  onHighlightDragOver(event: DragEvent) {
    event.preventDefault();
    this.isHighlightDragging.set(true);
  }

  onHighlightDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isHighlightDragging.set(false);
  }

  onHighlightDrop(event: DragEvent) {
    event.preventDefault();
    this.isHighlightDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.setHighlightImage(files[0], "mobile");
    }
  }

  onHighlightFileSelected(event: Event, tab: "mobile" | "desktop") {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setHighlightImage(file, tab, input);
    }
  }

  removeHighlightImage() {
    this.revokePreviewObjectUrl(this.highlightPreviewUrl());
    this.highlightPreviewUrl.set(null);
    this.selectedHighlightFileName.set(null);
    this.offerForm.patchValue({ highlightImage: null });
    this.offerForm.get("highlightImage")?.markAsDirty();
    this.offerForm.get("highlightImage")?.updateValueAndValidity();
    this.offerForm.markAsDirty();
    clearFileInputValue(this.highlightMobileFileInputRef?.nativeElement);
  }

  removeHighlightLandscapeImage() {
    this.revokePreviewObjectUrl(this.highlightLandscapePreviewUrl());
    this.highlightLandscapePreviewUrl.set(null);
    this.selectedHighlightLandscapeFileName.set(null);
    this.offerForm.patchValue({ highlightImageLandscape: null });
    this.offerForm.get("highlightImageLandscape")?.markAsDirty();
    this.offerForm.get("highlightImageLandscape")?.updateValueAndValidity();
    this.offerForm.markAsDirty();
    clearFileInputValue(this.highlightDesktopFileInputRef?.nativeElement);
  }

  // ── Image Cropper ────────────────────────────────────────────────────────

  cropperVisible = signal(false);
  cropperMounted = signal(true);
  cropperImageUrl = signal("");
  cropperTarget = signal<"offer" | "highlight">("offer");
  offerCropTab = signal<"mobile" | "desktop">("mobile");
  offerCropWorkflowMode = signal<"full" | "single">("single");
  highlightCropTab = signal<"mobile" | "desktop">("mobile");
  highlightCropWorkflowMode = signal<"full" | "single">("single");
  cropperZoom = signal(1);
  croppedImageBlob: Blob | null = null;

  cropperTransform = computed(() => ({
    scale: this.cropperZoom(),
    translateH: 0,
    translateV: 0,
    rotate: 0,
    flipH: false,
    flipV: false,
  }));

  private openCropper(
    target: "offer" | "highlight",
    source: File | string,
    input: HTMLInputElement | null,
    highlightTab: "mobile" | "desktop" = "mobile",
  ): void {
    this.cropperTarget.set(target);
    this.pendingCropInput = input;
    this.croppedImageBlob = null;
    this.setCropperImageSource(source, target);

    if (target === "offer") {
      this.offerCropSource = source;
      this.offerCropMobileBlob = null;
      this.offerCropDesktopBlob = null;
      this.offerZoomByTab = { mobile: 1, desktop: 1 };
      this.offerCropTab.set("mobile");
      this.offerCropWorkflowMode.set(
        source instanceof File ? "full" : "single",
      );
    } else {
      this.highlightCropSourceByTab[highlightTab] = source;
      this.highlightCropMobileBlob = null;
      this.highlightCropDesktopBlob = null;
      this.highlightZoomByTab = { mobile: 1, desktop: 1 };
      this.highlightCropTab.set(highlightTab);
      this.highlightCropWorkflowMode.set("single");
    }

    this.cropperZoom.set(1);
    this.refreshCropperInstance();

    this.cropperVisible.set(true);
  }

  recropOfferImage(tab: "mobile" | "desktop" = "mobile"): void {
    const source = this.resolveOfferCropSource(tab);
    if (!source) return;

    this.openCropper(
      "offer",
      source,
      this.offerFileInputRef?.nativeElement ?? null,
    );
    this.offerCropWorkflowMode.set("single");
    if (tab === "desktop") {
      this.switchOfferCropTab("desktop");
    }
  }

  recropHighlightImage(tab: "mobile" | "desktop"): void {
    const source = this.resolveHighlightCropSource(tab);
    if (!source) return;

    this.openCropper(
      "highlight",
      source,
      this.getHighlightFileInputRef(tab) ?? null,
      tab,
    );
    this.highlightCropWorkflowMode.set("single");
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (this.cropperTarget() === "offer") {
      if (this.offerCropTab() === "mobile") {
        this.offerCropMobileBlob = event.blob ?? null;
      } else {
        this.offerCropDesktopBlob = event.blob ?? null;
      }
      return;
    }

    if (this.highlightCropTab() === "mobile") {
      this.highlightCropMobileBlob = event.blob ?? null;
    } else {
      this.highlightCropDesktopBlob = event.blob ?? null;
    }
  }

  get cropperAspectRatio(): number {
    if (this.cropperTarget() === "offer") {
      return this.offerCropTab() === "mobile" ? 2.39 / 1 : 16 / 2;
    }
    return this.highlightCropTab() === "mobile" ? 9 / 16 : 16 / 9;
  }

  get cropperResizeWidth(): number {
    if (this.cropperTarget() === "offer") {
      return this.offerCropTab() === "mobile" ? 1600 : 1920;
    }
    return this.highlightCropTab() === "mobile" ? 1080 : 1600;
  }

  get canApplyCrop(): boolean {
    if (this.cropperTarget() === "offer") {
      if (this.isOfferSequentialFlow() && this.offerCropTab() === "mobile") {
        return !!this.offerCropMobileBlob;
      }
      return (
        this.hasOfferCropResult("mobile") && this.hasOfferCropResult("desktop")
      );
    }
    return this.highlightCropTab() === "mobile"
      ? !!this.highlightCropMobileBlob
      : !!this.highlightCropDesktopBlob;
  }

  isOfferSequentialFlow(): boolean {
    return (
      this.cropperTarget() === "offer" &&
      this.offerCropWorkflowMode() === "full"
    );
  }

  get cropperPrimaryActionLabel(): string {
    if (this.isOfferSequentialFlow() && this.offerCropTab() === "mobile") {
      return "offerForm.cropper.next";
    }
    return "offerForm.cropper.apply";
  }

  get cropperPrimaryActionIcon(): string {
    if (this.isOfferSequentialFlow() && this.offerCropTab() === "mobile") {
      return "";
    }
    return "pi pi-check";
  }

  get canOpenDesktopOfferTab(): boolean {
    if (!this.isOfferSequentialFlow()) {
      return true;
    }
    return this.offerCropTab() === "desktop" || !!this.offerCropMobileBlob;
  }

  get canOpenDesktopHighlightTab(): boolean {
    return this.hasHighlightCropSource("desktop");
  }

  zoomIn(): void {
    const current = this.cropperZoom();
    if (current < 3) {
      this.setCropperZoom(Math.min(3, +(current + 0.1).toFixed(1)));
    }
  }

  zoomOut(): void {
    const current = this.cropperZoom();
    if (current > 0.1) {
      this.setCropperZoom(Math.max(0.1, +(current - 0.1).toFixed(1)));
    }
  }

  onZoomSlider(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.setCropperZoom(value);
  }

  switchOfferCropTab(tab: "mobile" | "desktop"): void {
    if (this.cropperTarget() !== "offer" || this.offerCropTab() === tab) {
      return;
    }
    if (tab === "desktop" && !this.canOpenDesktopOfferTab) {
      return;
    }

    this.offerZoomByTab[this.offerCropTab()] = this.cropperZoom();
    this.offerCropTab.set(tab);
    this.cropperZoom.set(this.offerZoomByTab[tab]);

    const source = this.resolveOfferCropSource(tab);
    if (source) {
      this.setCropperImageSource(source, "offer");
    }

    this.refreshCropperInstance();
  }

  switchHighlightCropTab(tab: "mobile" | "desktop"): void {
    if (
      this.cropperTarget() !== "highlight" ||
      this.highlightCropTab() === tab
    ) {
      return;
    }
    if (tab === "desktop" && !this.canOpenDesktopHighlightTab) {
      return;
    }

    this.highlightZoomByTab[this.highlightCropTab()] = this.cropperZoom();
    this.highlightCropTab.set(tab);
    this.cropperZoom.set(this.highlightZoomByTab[tab]);

    const source = this.resolveHighlightCropSource(tab);
    if (source) {
      this.setCropperImageSource(source, "highlight");
    }

    this.refreshCropperInstance();
  }

  applyCrop(): void {
    const target = this.cropperTarget();

    if (target === "offer") {
      if (this.isOfferSequentialFlow() && this.offerCropTab() === "mobile") {
        if (!this.offerCropMobileBlob) return;
        this.switchOfferCropTab("desktop");
        return;
      }

      if (!this.canApplyCrop) return;

      const mobileFile = this.offerCropMobileBlob
        ? new File(
          [this.offerCropMobileBlob],
          `${this.pendingCropFileName}-mobile-cropped.png`,
          { type: "image/png" },
        )
        : null;
      const desktopFile = this.offerCropDesktopBlob
        ? new File(
          [this.offerCropDesktopBlob],
          `${this.pendingCropFileName}-desktop-cropped.png`,
          { type: "image/png" },
        )
        : null;

      if (mobileFile) {
        const mobileBlobUrl = URL.createObjectURL(mobileFile);
        this.revokePreviewObjectUrl(this.previewUrl());
        this.previewUrl.set(mobileBlobUrl);
        this.selectedOfferFileName.set(mobileFile.name);
        this.offerForm.patchValue({ offerImage: mobileFile });
        this.offerForm.get("offerImage")?.markAsDirty();
        this.offerForm.get("offerImage")?.updateValueAndValidity();
      }

      if (desktopFile) {
        const desktopBlobUrl = URL.createObjectURL(desktopFile);
        this.revokePreviewObjectUrl(this.offerLandscapePreviewUrl());
        this.offerLandscapePreviewUrl.set(desktopBlobUrl);
        this.selectedOfferLandscapeFileName.set(desktopFile.name);
        this.offerForm.patchValue({ offerImageLandscape: desktopFile });
        this.offerForm.get("offerImageLandscape")?.markAsDirty();
        this.offerForm.get("offerImageLandscape")?.updateValueAndValidity();
      }
    } else {
      if (!this.canApplyCrop) return;
      const isMobile = this.highlightCropTab() === "mobile";
      const highlightBlob = isMobile
        ? this.highlightCropMobileBlob
        : this.highlightCropDesktopBlob;
      if (!highlightBlob) return;

      const file = new File(
        [highlightBlob],
        `${this.pendingCropFileName}-${isMobile ? "mobile" : "desktop"}-cropped.png`,
        { type: "image/png" },
      );
      const blobUrl = URL.createObjectURL(file);

      if (isMobile) {
        this.revokePreviewObjectUrl(this.highlightPreviewUrl());
        this.highlightPreviewUrl.set(blobUrl);
        this.selectedHighlightFileName.set(file.name);
        this.offerForm.patchValue({ highlightImage: file });
        this.offerForm.get("highlightImage")?.markAsDirty();
        this.offerForm.get("highlightImage")?.updateValueAndValidity();
      } else {
        this.revokePreviewObjectUrl(this.highlightLandscapePreviewUrl());
        this.highlightLandscapePreviewUrl.set(blobUrl);
        this.selectedHighlightLandscapeFileName.set(file.name);
        this.offerForm.patchValue({ highlightImageLandscape: file });
        this.offerForm.get("highlightImageLandscape")?.markAsDirty();
        this.offerForm.get("highlightImageLandscape")?.updateValueAndValidity();
      }
    }

    this.offerForm.markAsDirty();
    this.cancelCrop(false);
  }

  cancelCrop(clearInput = true): void {
    if (clearInput) {
      clearFileInputValue(this.pendingCropInput ?? undefined);
    }
    this.cropperVisible.set(false);
    this.cropperMounted.set(true);
    this.cropperImageUrl.set("");
    this.croppedImageBlob = null;
    this.cropperZoom.set(1);
    this.offerCropMobileBlob = null;
    this.offerCropDesktopBlob = null;
    this.offerZoomByTab = { mobile: 1, desktop: 1 };
    this.offerCropWorkflowMode.set("single");
    this.offerCropSource = null;
    this.highlightCropMobileBlob = null;
    this.highlightCropDesktopBlob = null;
    this.highlightZoomByTab = { mobile: 1, desktop: 1 };
    this.highlightCropWorkflowMode.set("single");
    this.highlightCropSourceByTab = { mobile: null, desktop: null };
    this.pendingCropInput = null;
    this.pendingCropFileName = "offer-image";
    this.resetCropperSourceObjectUrl();
  }

  private setCropperZoom(value: number): void {
    this.cropperZoom.set(value);
    if (this.cropperTarget() === "offer") {
      this.offerZoomByTab[this.offerCropTab()] = value;
    } else {
      this.highlightZoomByTab[this.highlightCropTab()] = value;
    }
  }

  private refreshCropperInstance(): void {
    this.cropperMounted.set(false);
    queueMicrotask(() => this.cropperMounted.set(true));
  }

  private hasOfferCropResult(tab: "mobile" | "desktop"): boolean {
    const pendingBlob =
      tab === "mobile" ? this.offerCropMobileBlob : this.offerCropDesktopBlob;
    if (pendingBlob) {
      return true;
    }

    const controlName = tab === "mobile" ? "offerImage" : "offerImageLandscape";
    const value = this.offerForm.get(controlName)?.value;
    return (
      value instanceof File ||
      (typeof value === "string" && value.trim().length > 0)
    );
  }

  private hasHighlightCropResult(tab: "mobile" | "desktop"): boolean {
    const pendingBlob =
      tab === "mobile"
        ? this.highlightCropMobileBlob
        : this.highlightCropDesktopBlob;
    if (pendingBlob) {
      return true;
    }

    const controlName =
      tab === "mobile" ? "highlightImage" : "highlightImageLandscape";
    const value = this.offerForm.get(controlName)?.value;
    return (
      value instanceof File ||
      (typeof value === "string" && value.trim().length > 0)
    );
  }

  private resolveOfferCropSource(
    tab: "mobile" | "desktop",
  ): File | string | null {
    const preferredControl =
      tab === "mobile" ? "offerImage" : "offerImageLandscape";
    const secondaryControl =
      tab === "mobile" ? "offerImageLandscape" : "offerImage";
    const preferredValue = this.offerForm.get(preferredControl)?.value;
    const secondaryValue = this.offerForm.get(secondaryControl)?.value;

    if (preferredValue instanceof File) {
      return preferredValue;
    }
    if (typeof preferredValue === "string" && preferredValue.trim()) {
      return preferredValue;
    }
    if (secondaryValue instanceof File) {
      return secondaryValue;
    }
    if (typeof secondaryValue === "string" && secondaryValue.trim()) {
      return secondaryValue;
    }

    if (this.offerCropSource) {
      return this.offerCropSource;
    }

    return null;
  }

  private resolveHighlightCropSource(
    tab: "mobile" | "desktop",
  ): File | string | null {
    const preferredControl =
      tab === "mobile" ? "highlightImage" : "highlightImageLandscape";
    const preferredValue = this.offerForm.get(preferredControl)?.value;

    if (preferredValue instanceof File) {
      return preferredValue;
    }
    if (typeof preferredValue === "string" && preferredValue.trim()) {
      return preferredValue;
    }
    return this.highlightCropSourceByTab[tab];
  }

  private hasHighlightCropSource(tab: "mobile" | "desktop"): boolean {
    return !!this.resolveHighlightCropSource(tab);
  }

  private getHighlightFileInputRef(
    tab: "mobile" | "desktop",
  ): HTMLInputElement | null | undefined {
    return tab === "mobile"
      ? this.highlightMobileFileInputRef?.nativeElement
      : this.highlightDesktopFileInputRef?.nativeElement;
  }

  private resetCropperSourceObjectUrl(): void {
    if (this.cropperSourceObjectUrl) {
      URL.revokeObjectURL(this.cropperSourceObjectUrl);
      this.cropperSourceObjectUrl = null;
    }
  }

  private setCropperImageSource(
    source: File | string,
    target: "offer" | "highlight",
  ): void {
    this.resetCropperSourceObjectUrl();

    if (source instanceof File) {
      this.pendingCropFileName =
        source.name.replace(/\.[^.]+$/, "") || `offer-${target}`;
      this.cropperSourceObjectUrl = URL.createObjectURL(source);
      this.cropperImageUrl.set(this.cropperSourceObjectUrl);
      return;
    }

    this.pendingCropFileName = `offer-${target}`;
    this.cropperImageUrl.set(this.resolveCropperImageUrl(source));
  }

  private resolveCropperImageUrl(source: string): string {
    if (source.startsWith("blob:") || source.startsWith("data:")) {
      return source;
    }
    if (source.includes("storage.googleapis.com")) {
      return `http://localhost:3000/api/v1/image-proxy?url=${encodeURIComponent(source)}`;
    }
    return source;
  }

  private revokePreviewObjectUrl(url: string | ArrayBuffer | null): void {
    if (typeof url === "string" && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }

  mapFormToPayload(form: any): CreateOfferPayload {
    const rawDiscountEn = form.discountEn ? String(form.discountEn).trim() : "";
    const rawDiscountAr = form.discountAr ? String(form.discountAr).trim() : "";
    const rawDiscountCode = form.discountCode
      ? String(form.discountCode).trim()
      : "";
    const shouldSendHotelDetails = this.showHotelDetails();
    const hotelPayload = shouldSendHotelDetails
      ? {
        hotelStarRating: form.hotelRating === "Yes",
        hotelAmenitites: form.hotelAmenities
          ? String(form.hotelAmenities)
            .split(",")
            .map((item: string) => item.trim())
            .filter((item: string) => !!item)
          : [],
        hotelAmenitites_ar: form.hotelAmenitiesAr
          ? String(form.hotelAmenitiesAr)
            .split(",")
            .map((item: string) => item.trim())
            .filter((item: string) => !!item)
          : [],
        rooms:
          this.roomItems().length || this.normalizeRoomsCount(form.rooms),
        roomDetails: this.mapRoomDetailsToPayload(),
        currency: form.currency ? String(form.currency).trim() : "",
        currency_ar: form.currency ? String(form.currency).trim() : null,
        taxValue: form.taxValue ? String(form.taxValue).trim() : "",
        taxValue_ar: form.taxValueAr ? String(form.taxValueAr).trim() : "",
      }
      : {};
    const discountType =
      typeof form.discountType === "string"
        ? form.discountType.toLowerCase()
        : form.discountType;

    return {
      vendorId: form.selectedVendor,

      categoryIds: Array.isArray(form.category)
        ? form.category.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim() !== "",
        )
        : [],

      title: form.titleEn,
      title_ar: form.titleAr,
      description: form.descriptionEn,
      description_ar: form.descriptionAr,

      targetAudience: Array.isArray(form.targetAudience)
        ? form.targetAudience.filter(
          (v: unknown): v is string =>
            typeof v === "string" && v.trim() !== "",
        )
        : [],

      // New highlight payload fields
      highlight_title: form.highlightTitleEn || "",
      highlight_title_ar: form.highlightTitleAr || "",
      highlight_description: form.highlightDescription || "",
      highlight_description_ar: form.highlightDescriptionAr || "",
      // Legacy highlight description fields kept for backend compatibility
      highlights: form.highlightDescription || "",
      highlights_ar: form.highlightDescriptionAr || "",

      howToAvail: form.instructionsEn,
      howToAvail_ar: form.instructionsAr,

      discountType, // Percentage → percentage / fixed / others

      discount_amount: rawDiscountEn,
      discount_amount_ar: rawDiscountAr,
      discountCode:
        form.mode !== "In-Store" && rawDiscountCode
          ? rawDiscountCode
          : undefined,
      discount_url: form.urlLink ? form.urlLink : undefined,
      website:
        (form.mode === "In-Store" || form.mode === "In-Store & Digital") &&
          form.urlLink?.trim()
          ? form.urlLink.trim()
          : undefined,

      offerMode: mapFormModeToOfferMode(form.mode),

      startDate: form.startdate,
      expiryDate: form.expiry,

      locationIds:
        Array.isArray(form.locationIds) && form.mode !== "Digital"
          ? form.locationIds.filter((id: string) => !!id)
          : [],

      isActive: true,
      isFeatured: form.highlight,
      isHighlightEnabled: !!form.highlight,
      isPartnerHotel: false,

      email: form.email ? [form.email] : [],
      mobile: form.phone ? [form.phone] : [],
      telephone: form.landline ? [form.landline] : [],
      contacts: [],

      enableMapSearch: true,

      searchKeywords: [],
      tags: form.selectedTags || [],

      createdByRole: "Personnel",

      image: form.offerImage,
      image_landscape: form.offerImageLandscape,
      highlight_image: form.highlightImage,
      highlight_image_landscape: form.highlightImageLandscape,
      ...hotelPayload,
    };
  }

  private normalizeRoomsCount(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }

  private mapApiRoomsToDrafts(roomDetails: unknown): OfferRoomDraft[] {
    if (!Array.isArray(roomDetails)) {
      return [];
    }

    return roomDetails.map((room: any, roomIndex: number) => ({
      id: room?.id ?? room?._id?.$oid ?? `existing-room-${roomIndex + 1}`,
      roomName: room?.roomName ?? "",
      roomNameAr: room?.roomNameAr ?? "",
      rates: Array.isArray(room?.rates)
        ? room.rates.map((rate: any, rateIndex: number) => ({
          id:
            rate?.id ??
            `existing-room-${roomIndex + 1}-rate-${rateIndex + 1}`,
          season: rate?.season ?? "",
          seasonAr: rate?.seasonAr ?? "",
          value: rate?.value != null ? String(rate.value) : "",
        }))
        : [],
    }));
  }

  private mapRoomDetailsToPayload() {
    return this.roomItems()
      .filter((room) => !room.isPlaceholder)
      .map((room) => ({
        roomName: room.roomName,
        roomNameAr: room.roomNameAr,
        rates: (room.rates ?? []).map((rate) => ({
          season: rate.season,
          seasonAr: rate.seasonAr,
          value: rate.value,
        })),
      }));
  }

  private createPlaceholderRoom(index: number): OfferRoomDraft {
    return {
      id: `existing-room-${index + 1}`,
      roomName: `Room ${index + 1}`,
      roomNameAr: "",
      rates: [],
      isPlaceholder: true,
    };
  }

  private normalizeCategoryIds(offerdetails: any): string[] {
    if (Array.isArray(offerdetails?.categoryIds)) {
      return offerdetails.categoryIds.filter(
        (id: unknown): id is string =>
          typeof id === "string" && id.trim() !== "",
      );
    }

    if (Array.isArray(offerdetails?.categories)) {
      return offerdetails.categories
        .map((category: any) => {
          if (typeof category === "string") return category;
          return category?._id?.$oid ?? category?._id ?? category?.id ?? "";
        })
        .filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim() !== "",
        );
    }

    const singleCategoryId =
      offerdetails?.category?._id?.$oid ??
      offerdetails?.category?._id ??
      offerdetails?.categoryId ??
      "";

    return typeof singleCategoryId === "string" &&
      singleCategoryId.trim() !== ""
      ? [singleCategoryId]
      : [];
  }

  readonly previewOffer = computed(() => {
    const form = this.formPreviewValue();
    const selectedVendorId = form?.selectedVendor;
    const selectedVendor =
      this.vendors().find((v: any) => {
        const vid = v?._id?.$oid || v?._id;
        return vid === selectedVendorId;
      }) ?? this.selectedVendorDetails();
    const previewImage =
      typeof this.previewUrl() === "string"
        ? this.previewUrl()
        : typeof form?.offerImage === "string"
          ? form.offerImage
          : "";

    return {
      title: form?.titleEn || "",
      title_ar: form?.titleAr || "",
      description: form?.descriptionEn || "",
      description_ar: form?.descriptionAr || "",
      howToAvail: form?.instructionsEn || "",
      howToAvail_ar: form?.instructionsAr || "",
      discount_amount: form?.discountEn || "",
      discount_amount_ar: form?.discountAr || "",
      discountCode: form?.discountCode || "",
      discountType:
        typeof form?.discountType === "string"
          ? form.discountType.toLowerCase()
          : "",
      expiryDate: form?.expiry ? { $date: form.expiry } : null,
      image: previewImage,
      mobile: form?.phone || "",
      email: form?.email || "",
      telephone: form?.landline || "",
      offerMode: mapFormModeToOfferMode(form?.mode),
      vendor: selectedVendor
        ? {
          name: selectedVendor.name,
          name_ar: selectedVendor.name_ar,
          logo: (selectedVendor as any).logo,
        }
        : null,
    };
  });

  get previewLocations() {
    return this.vendorLocations().map((location) => ({
      branch_name: location.label,
      branch_name_ar: (location as any).branch_name_ar,
      address: location.address,
      address_ar: (location as any).address_ar,
      city: location.city,
      city_ar: (location as any).city_ar,
    }));
  }
}
