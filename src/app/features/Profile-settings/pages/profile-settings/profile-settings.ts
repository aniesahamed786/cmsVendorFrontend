import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { PrimeUIModules } from '../../../../core/prime.import';
import { Button } from '../../../../shared/Components/button/button';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { I18nService, AppLang } from '../../../../shared/i18n/i18n.service';
import { ThemeService, AppearanceMode } from '../../../../shared/services/theme.service';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ProfileSettingsService,
  VendorAccountLanguage,
  VendorAccountTheme,
} from '../../services/profile-settings.service';

/** UI values ↔ the API's enums (vendor_accounts.language / .theme). */
const LANGUAGE_TO_API: Record<AppLang, VendorAccountLanguage> = { en: 'ENGLISH', ar: 'ARABIC' };
const THEME_TO_API: Record<AppearanceMode, VendorAccountTheme> = {
  light: 'LIGHT',
  dark: 'DARK',
  system: 'SYSTEM',
};

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

/**
 * The password fields are optional as a set: leaving all three blank saves only the language
 * and theme. Once any of them is filled, all three become required — a half-filled password
 * change is never valid.
 */
function passwordGroupValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const current = group.get('currentPassword')?.value ?? '';
    const next = group.get('newPassword')?.value ?? '';
    const confirm = group.get('confirmPassword')?.value ?? '';

    if (!current && !next && !confirm) {
      return null;
    }
    return current && next && confirm ? null : { passwordIncomplete: true };
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
  private readonly settingsService = inject(ProfileSettingsService);
  private readonly messageService = inject(MessageService);
  private readonly auth = inject(AuthService);

  readonly isArabic = this.i18n.isRtl;
  readonly currentLang = this.i18n.lang;

  /**
   * What the account currently has stored, seeded from the vendorAccount saved at login. Used
   * to tell a real preference change from the user simply landing on the page.
   */
  private readonly savedLanguage = signal<VendorAccountLanguage>(
    this.auth.getVendorAccount()?.language ?? 'ENGLISH',
  );
  private readonly savedTheme = signal<VendorAccountTheme>(
    this.auth.getVendorAccount()?.theme ?? 'LIGHT',
  );

  // Password fields carry no per-control `required`: they are optional as a set, enforced
  // together by passwordGroupValidator so language/theme can be saved on their own.
  readonly securityForm = this.fb.group(
    {
      currentPassword: [''],
      newPassword: [''],
      confirmPassword: [''],
    },
    { validators: [passwordsMatchValidator(), passwordGroupValidator()] },
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

  /** True while a password change is being entered — the strength rules only apply then. */
  readonly isChangingPassword = computed(() => (this.newPasswordValue() ?? '').length > 0);

  readonly saving = signal(false);

  /**
   * Language and theme apply instantly on click but are only persisted here, so the button
   * stays available whenever either differs from what the account last saved.
   */
  readonly hasPreferenceChanges = computed(
    () =>
      LANGUAGE_TO_API[this.currentLang()] !== this.savedLanguage() ||
      THEME_TO_API[this.currentThemeMode()] !== this.savedTheme(),
  );

  get isSecuritySaveDisabled(): boolean {
    if (this.saving()) {
      return true;
    }
    // A half-filled or mismatched password blocks the save outright.
    if (this.securityForm.invalid) {
      return true;
    }
    if (this.isChangingPassword()) {
      return !this.allPasswordChecksPass();
    }
    // No password being set — only worth saving if a preference actually changed.
    return !this.hasPreferenceChanges();
  }

  /**
   * The password fields are only required once one of them has been filled, so "required"
   * now means "this one is blank while a password change is in progress".
   */
  hasRequiredError(controlName: string): boolean {
    const control = this.securityForm.get(controlName);
    if (!control?.touched || control.value) {
      return false;
    }
    return this.securityForm.hasError('passwordIncomplete');
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

  /**
   * Persists language, theme and — when the vendor filled them in — the new password, in a
   * single PATCH. The password is sent as entered and hashed server-side; it is never stored
   * or logged here.
   */
  saveSecurityChanges(): void {
    if (this.isSecuritySaveDisabled) {
      this.securityForm.markAllAsTouched();
      return;
    }

    const language = LANGUAGE_TO_API[this.currentLang()];
    const theme = THEME_TO_API[this.currentThemeMode()];
    const changingPassword = this.isChangingPassword();

    this.saving.set(true);
    this.settingsService
      .updateSettings({
        language,
        theme,
        ...(changingPassword
          ? {
              currentPassword: this.securityForm.value.currentPassword ?? '',
              newPassword: this.securityForm.value.newPassword ?? '',
            }
          : {}),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (account) => {
          // The saved baseline moves forward, so the button settles back to disabled.
          this.savedLanguage.set(account.language ?? language);
          this.savedTheme.set(account.theme ?? theme);
          this.auth.updateVendorAccountPreferences(account.language, account.theme);
          this.securityForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
          this.toast(
            'success',
            'settingsPage.toast.savedSummary',
            changingPassword ? 'settingsPage.toast.savedWithPasswordDetail' : 'settingsPage.toast.savedDetail',
          );
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to update profile settings', err);
          this.messageService.add({
            severity: 'error',
            summary: this.i18n.t('settingsPage.toast.saveFailedSummary'),
            // A 401 here means the current password was wrong — the backend says so precisely.
            detail: extractApiErrorMessage(err) ?? this.i18n.t('settingsPage.toast.saveFailedDetail'),
            life: 5000,
          });
        },
      });
  }

  private toast(severity: 'success' | 'error', summaryKey: string, detailKey: string): void {
    this.messageService.add({
      severity,
      summary: this.i18n.t(summaryKey),
      detail: this.i18n.t(detailKey),
      life: 3000,
    });
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