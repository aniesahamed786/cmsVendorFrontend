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
