import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { InputOtpModule } from 'primeng/inputotp';
import { AuthService, LoginResponse } from '../../../core/services/auth.service';
import { Button } from '../../../shared/Components/button/button';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { AppearanceMode, ThemeService } from '../../../shared/services/theme.service';

const API_TO_LANGUAGE = {
  ENGLISH: 'en',
  ARABIC: 'ar',
} as const;

/** vendor_accounts.theme → the UI's appearance modes (inverse of the settings page's map). */
const API_TO_THEME: Record<string, AppearanceMode> = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// ponytail: fixed code until the backend sends a real OTP — swap verifyOtp() for an API call then.
const DEV_OTP = '111111';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    InputOtpModule,
    Button,
    TranslatePipe
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly isDark = this.theme.isDarkMode;

  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap);
  /** Set when a login attempt is refused locally (suspended account). */
  private readonly loginNotice = signal<string>('');
  /** Values for the notice's {{placeholders}} — attempts left, minutes until unlock. */
  readonly noticeParams = signal<Record<string, number>>({});

  /**
   * One line above the form for the three ways a user lands here without credentials failing:
   * an expired session, a suspended account, or a refused sign-in.
   */
  readonly notice = computed(() => {
    if (this.loginNotice()) return this.loginNotice();
    if (this.pendingLogin()) return '';
    const params = this.queryParams();
    if (params?.get('account') === 'inactive') return 'login.accountInactive';
    if (params?.get('session') === 'expired') return 'login.sessionExpired';
    return '';
  });

  loginForm: FormGroup;

  /** Credentials accepted, waiting on the OTP. The session isn't stored until the code checks out. */
  readonly pendingLogin = signal<LoginResponse | null>(null);
  readonly otpForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] })
  });

  isSubmitting = false;

 constructor(
  private fb: FormBuilder,
  private authService: AuthService,
  private router: Router
) {

    this.loginForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ]
    });

  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  /** Login is pre-shell, so this is the only language switch an Arabic user can reach. */
  toggleLanguage(): void {
    void this.i18n.toggle();
  }

  /** Same reason: no navbar here, so this is the only theme switch before signing in. */
  toggleTheme(): void {
    this.theme.setAppearanceMode(this.isDark() ? 'light' : 'dark');
  }

  login(): void {

  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    return;
  }

  const payload = {
    email: this.loginForm.value.email,
    password: this.loginForm.value.password
  };

  console.log('Request Payload:', payload);

  this.authService.login(payload).subscribe({

    next: (response) => {

      // A suspended account still gets a token. Don't open the app with it.
      if (response.vendorAccount?.accountStatus !== 'ACTIVE') {
        this.loginNotice.set('login.accountInactive');
        return;
      }

      this.loginNotice.set('');
      this.otpForm.reset();
      this.pendingLogin.set(response);

    },

    error: (error: HttpErrorResponse) => {

      console.error('Login Failed:', error);

      const body = error.error ?? {};

      // 423: locked after too many wrong passwords. The body says when it lifts.
      if (error.status === 423) {
        const msLeft = new Date(body.lockedUntil).getTime() - Date.now();
        this.noticeParams.set({ minutes: Math.max(1, Math.ceil(msLeft / 60_000) || 1) });
        this.loginNotice.set('login.accountLocked');
        return;
      }

      // 403: right password, but the account is suspended.
      if (error.status === 403) {
        this.loginNotice.set('login.accountInactive');
        return;
      }

      // 401 carries how many tries are left before the lock; older responses don't.
      if (typeof body.attemptsRemaining === 'number') {
        this.noticeParams.set({ count: body.attemptsRemaining });
        this.loginNotice.set('login.invalidCredentialsAttempts');
        return;
      }

      this.loginNotice.set('login.invalidCredentials');

    }

  });

}

  verifyOtp(): void {
    const response = this.pendingLogin();
    if (!response) return;
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }
    if (this.otpForm.getRawValue().code !== DEV_OTP) {
      this.loginNotice.set('login.otpInvalid');
      return;
    }
    void this.completeLogin(response);
  }

  /** Back to the credentials form — the pending token is dropped, never stored. */
  backToLogin(): void {
    this.pendingLogin.set(null);
    this.loginNotice.set('');
  }

  private async completeLogin(response: LoginResponse): Promise<void> {
    this.loginNotice.set('');
    this.authService.setSession(response.accessToken, response.vendorAccount);

    // The account's saved theme was stored but never applied — the settings page
    // writes it, so honour it here or a second device never picks it up.
    const saved = API_TO_THEME[response.vendorAccount.theme ?? ''];
    if (saved) {
      this.theme.setAppearanceMode(saved);
    }

    const savedLanguage = response.vendorAccount.language
      ? API_TO_LANGUAGE[response.vendorAccount.language]
      : undefined;
    if (savedLanguage) {
      await this.i18n.setLang(savedLanguage);
    }

    void this.router.navigate(['/dashboard']);
  }

}
