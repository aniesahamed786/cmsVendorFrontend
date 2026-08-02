import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { ThemeService, AppearanceMode } from '../../../../shared/services/theme.service';

interface PasswordChecks {
  length: boolean;
  case: boolean;
  number: boolean;
  special: boolean;
}

function passwordsMatchValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const newPassword = group.get('newPassword')?.value ?? '';
    const confirmPassword = group.get('confirmPassword')?.value ?? '';
    if (!confirmPassword) {
      return null;
    }
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PrimeUIModules, Button, TranslatePipe],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.scss',
})
export class ProfileSettings {
  private readonly fb = inject(FormBuilder);
  private readonly themeService = inject(ThemeService);
  private readonly i18n = inject(I18nService);

  readonly isArabic = this.i18n.isRtl;
  readonly currentLang = this.i18n.lang;

  readonly securityForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator() },
  );

  private readonly newPasswordValue = toSignal(this.securityForm.controls.newPassword.valueChanges, {
    initialValue: '',
  });

  readonly passwordChecks = computed<PasswordChecks>(() => {
    const value = this.newPasswordValue() ?? '';
    return {
      length: value.length >= 8,
      case: /[a-z]/.test(value) && /[A-Z]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-z0-9]/.test(value),
    };
  });

  readonly allPasswordChecksPass = computed(() => {
    const checks = this.passwordChecks();
    return checks.length && checks.case && checks.number && checks.special;
  });

  twoFactorEnabled = false;

  readonly themeModes = this.themeService.appearanceModes;
  readonly currentThemeMode = this.themeService.appearanceMode;

  get isSecuritySaveDisabled(): boolean {
    return (
      this.securityForm.invalid ||
      !this.allPasswordChecksPass() ||
      this.securityForm.hasError('passwordMismatch')
    );
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.securityForm.get(controlName);
    return !!control && control.touched && control.hasError('required');
  }

  hasPasswordMismatchError(): boolean {
    const confirmControl = this.securityForm.get('confirmPassword');
    return !!confirmControl?.touched && this.securityForm.hasError('passwordMismatch');
  }

  onTwoFactorToggle(value: boolean): void {
    this.twoFactorEnabled = value;
  }

  discardSecurityChanges(): void {
    this.securityForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    this.twoFactorEnabled = false;
  }

  saveSecurityChanges(): void {
    if (this.isSecuritySaveDisabled) {
      this.securityForm.markAllAsTouched();
      return;
    }
    console.log('Save Changes values:', {
      currentPassword: this.securityForm.value.currentPassword,
      newPassword: this.securityForm.value.newPassword,
      twoFactorEnabled: this.twoFactorEnabled,
    });
    this.securityForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }

  setLanguage(lang: 'en' | 'ar'): void {
    if (this.currentLang() === lang) {
      return;
    }
    void this.i18n.toggle();
  }

  setThemeMode(mode: AppearanceMode): void {
    this.themeService.setAppearanceMode(mode);
  }

  themeLabel(mode: AppearanceMode, fallbackLabel: string): string {
    this.i18n.lang();
    const keys: Partial<Record<AppearanceMode, string>> = {
      light: 'settingsPage.theme.light',
      dark: 'settingsPage.theme.dark',
      system: 'settingsPage.theme.system',
    };
    const key = keys[mode];
    if (!key) {
      return fallbackLabel;
    }
    const text = this.i18n.t(key);
    return text === key ? fallbackLabel : text;
  }

  openTerms(): void {
    window.open('/legal/terms', '_blank', 'noopener');
  }

  openPrivacyPolicy(): void {
    window.open('/legal/privacy', '_blank', 'noopener');
  }

  openDisclaimer(): void {
    window.open('/legal/disclaimer', '_blank', 'noopener');
  }
}