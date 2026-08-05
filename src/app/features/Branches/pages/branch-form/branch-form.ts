import { Component, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { CancelButton } from '../../../../shared/Components/cancel-button/cancel-button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { noWhitespaceValidator } from '../../../../shared/utils/form-validators';

export interface BranchFormModel {
  id?: string;
  locationNameEn: string;
  locationNameAr: string;
  country: string;
  region: string;
  city: string;
  address: string;
  googleMapLink: string;
  representativeName: string;
  phoneNumber: string;
}

/**
 * What the form emits. `requestSummary` is kept out of `payload` deliberately: it describes
 * the request, not the branch, and becomes the request's title — putting it in the model
 * would leak it into `requestData` and onto the stored location.
 */
export interface BranchFormSubmit {
  payload: BranchFormModel;
  requestSummary: string;
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
    CancelButton,
    TranslatePipe,
  ],
  templateUrl: './branch-form.html',
  styleUrl: './branch-form.scss',
})
export class BranchForm {
  private readonly phonePattern = /^[\d\s()+-]+$/;
  private readonly urlPattern =
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})[/\w .@?&=%_+!~*'()#,:;-]*\/?$/;

  // Public API — mirrors OfferForm's contract so callers can wire it up the
  // same way (`actionType`, `buttonName`, `backNavRouteLink`, edit payload).
  actionType = input<'create' | 'edit'>('create');
  buttonName = input<string>('Save');
  backNavRouteLink = input<string>('');
  editableFormData = input<BranchFormModel | null>(null);
  isLoading = input<boolean>(false);
  /** Hosts that already render their own back button turn this off to avoid a second one. */
  showBackNav = input<boolean>(true);
  /**
   * What the topbar's secondary button does. `draft` saves a draft (the branch pages);
   * `cancel` just leaves (the request-edit page, where there is no separate draft to save).
   */
  secondaryAction = input<'draft' | 'cancel'>('draft');
  /**
   * Seeds the Request Summary box. The request-edit page passes the request's current title
   * so the vendor amends what they wrote rather than retyping it.
   */
  initialRequestSummary = input<string>('');

  submitBranchFormEvent = output<BranchFormSubmit>();
  saveDraftEvent = output<BranchFormSubmit>();
  cancelEvent = output<void>();
  branchForm: FormGroup;

  constructor(private readonly fb: FormBuilder) {
    this.branchForm = this.fb.group({
      locationNameEn: ['', [Validators.required, noWhitespaceValidator()]],
      locationNameAr: ['', [Validators.required, noWhitespaceValidator()]],
      country: ['', [Validators.required, noWhitespaceValidator()]],
      region: ['', [Validators.required, noWhitespaceValidator()]],
      city: ['', [Validators.required, noWhitespaceValidator()]],
      address: ['', [Validators.required, noWhitespaceValidator()]],
      googleMapLink: [
        '',
        [Validators.required, Validators.pattern(this.urlPattern)],
      ],
      representativeName: ['', [Validators.required, noWhitespaceValidator()]],
      phoneNumber: [
        '',
        [
          Validators.required,
          Validators.maxLength(20),
          Validators.pattern(this.phonePattern),
        ],
      ],
      // Not part of the branch payload — this becomes the request's title. Required on every
      // path, draft included: a request is listed by its title the moment it exists.
      requestSummary: ['', [Validators.required, noWhitespaceValidator()]],
    });

    // Populate the form whenever edit data arrives (e.g. after the branch
    // record resolves), same pattern OfferForm uses for editableFormData.
    effect(() => {
      const data = this.editableFormData();
      if (data) {
        this.branchForm.patchValue(data, { emitEvent: false });
      }
    });

    // Seed the summary once the request loads. Left alone after the vendor has typed.
    effect(() => {
      const summary = this.initialRequestSummary();
      const control = this.branchForm.get('requestSummary');
      if (!control || control.dirty || !summary || control.value) return;
      control.setValue(summary, { emitEvent: false });
    });
  }

  get isEditMode(): boolean {
    return this.actionType() === 'edit';
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.branchForm.get(controlName);
    return !!control && control.touched && control.hasError('required');
  }

  hasFieldError(controlName: string, errorKey: string): boolean {
    const control = this.branchForm.get(controlName);
    return !!control && control.touched && control.hasError(errorKey);
  }

  isSubmitDisabled(): boolean {
    return this.isLoading();
  }

  submit(): void {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      return;
    }
    this.submitBranchFormEvent.emit({
      payload: this.buildPayload(),
      requestSummary: this.requestSummaryValue(),
    });
  }

  /** A draft is still listed by its title, so the summary is required here too. */
  onSaveDraft(): void {
    const summary = this.branchForm.get('requestSummary');
    if (summary?.invalid) {
      summary.markAsTouched();
      return;
    }
    this.saveDraftEvent.emit({
      payload: this.buildPayload(),
      requestSummary: this.requestSummaryValue(),
    });
  }

  private requestSummaryValue(): string {
    return String(this.branchForm.get('requestSummary')?.value ?? '').trim();
  }

  private buildPayload(): BranchFormModel {
    const form = this.branchForm.value;
    return {
      ...(this.editableFormData()?.id ? { id: this.editableFormData()!.id } : {}),
      locationNameEn: form.locationNameEn?.trim() ?? '',
      locationNameAr: form.locationNameAr?.trim() ?? '',
      country: form.country?.trim() ?? '',
      region: form.region?.trim() ?? '',
      city: form.city?.trim() ?? '',
      address: form.address?.trim() ?? '',
      googleMapLink: form.googleMapLink?.trim() ?? '',
      representativeName: form.representativeName?.trim() ?? '',
      phoneNumber: form.phoneNumber?.trim() ?? '',
    };
  }
}