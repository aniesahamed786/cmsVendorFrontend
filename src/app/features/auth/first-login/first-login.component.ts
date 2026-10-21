import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { finalize, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileSettingsService } from '../../Profile-settings/services/profile-settings.service';
import { Button } from '../../../shared/Components/button/button';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { ThemeService } from '../../../shared/services/theme.service';
import { extractApiErrorMessage } from '../../../shared/utils/api-error-message';
import { passwordChecks, passwordsMatchValidator } from '../../../shared/utils/form-validators';

/**
 * First sign-in on a handed-out password: the vendor picks its own before anything else.
 *
 * Only the new password is asked for — the one typed at sign-in goes along as `currentPassword`
 * (see AuthService.heldLoginPassword; firstLoginGuard sends the vendor back to sign in when it
 * is gone). Laid out like the login page, whose stylesheet it shares.
 */
@Component({
  selector: 'app-first-login',
  standalone: true,
  imports: [ReactiveFormsModule, PasswordModule, Button, TranslatePipe],
  templateUrl: './first-login.component.html',
  styleUrls: ['../login/login.component.scss', './first-login.component.scss'],
})
export class FirstLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly settings = inject(ProfileSettingsService);
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly isDark = this.theme.isDarkMode;

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatchValidator() },
  );

  private readonly newPassword = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });
  readonly checks = computed(() => passwordChecks(this.newPassword()));
  private readonly allChecksPass = computed(() => Object.values(this.checks()).every(Boolean));

  readonly saving = signal(false);
  /** The backend's own reason (reused or personal password …), or a translated fallback. */
  readonly error = signal('');

  showError(name: 'newPassword' | 'confirmPassword'): boolean {
    return this.form.controls[name].touched && this.form.controls[name].hasError('required');
  }

  get mismatch(): boolean {
    return this.form.controls.confirmPassword.touched && this.form.hasError('passwordMismatch');
  }

  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid || !this.allChecksPass()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.settings
      .updateSettings({
        currentPassword: this.auth.heldLoginPassword() ?? '',
        newPassword: this.form.getRawValue().newPassword,
      })
      // The service swaps in the new token first; the stage is then re-read with it.
      .pipe(
        switchMap(() => this.auth.refreshOnboarding()),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => {
          this.auth.holdLoginPassword(null);
          const next = this.auth.onboardingStage() === 'COMPLETE_PROFILE' ? '/profile/edit' : '/dashboard';
          void this.router.navigate([next]);
        },
        error: (err: HttpErrorResponse) => {
          // 401: the held sign-in password no longer matches — only a fresh sign-in fixes that.
          if (err.status === 401) {
            this.auth.logout({ password: 'required' });
            return;
          }
          this.error.set(extractApiErrorMessage(err) ?? this.i18n.t('firstLogin.failed'));
        },
      });
  }

  signOut(): void {
    this.auth.logout();
  }

  toggleLanguage(): void {
    void this.i18n.toggle();
  }

  toggleTheme(): void {
    this.theme.setAppearanceMode(this.isDark() ? 'light' : 'dark');
  }
}
