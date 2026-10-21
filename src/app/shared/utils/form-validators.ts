import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

/** The backend's password rules (UpdateVendorProfileSettingsDto), one flag per checklist line. */
export interface PasswordChecks {
  length: boolean;
  case: boolean;
  number: boolean;
  special: boolean;
}

export function passwordChecks(value: string): PasswordChecks {
  return {
    length: value.length >= 8,
    case: /[a-z]/.test(value) && /[A-Z]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

/** Group validator: `confirmPassword` must equal `newPassword` once it has been typed. */
export function passwordsMatchValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';
    if (!confirmPassword) {
      return null;
    }
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  };
}
