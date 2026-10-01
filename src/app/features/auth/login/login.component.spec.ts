import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { AuthService, LoginResponse } from '../../../core/services/auth.service';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let auth: { login: ReturnType<typeof vi.fn>; setSession: ReturnType<typeof vi.fn> };
  let i18n: {
    lang: ReturnType<typeof signal<'en' | 'ar'>>;
    loadSeq: ReturnType<typeof signal<number>>;
    t: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    setLang: ReturnType<typeof vi.fn>;
  };
  let theme: { isDarkMode: ReturnType<typeof signal<boolean>>; setAppearanceMode: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { login: vi.fn(), setSession: vi.fn() };
    i18n = {
      lang: signal<'en' | 'ar'>('en'),
      loadSeq: signal(0),
      t: vi.fn((key: string) => key),
      toggle: vi.fn(),
      setLang: vi.fn().mockResolvedValue(undefined),
    };
    theme = { isDarkMode: signal(false), setAppearanceMode: vi.fn() };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: I18nService, useValue: i18n },
        { provide: ThemeService, useValue: theme },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const response: LoginResponse = {
    accessToken: 'token',
    vendorAccount: {
      id: 'account-1',
      vendorId: 'vendor-1',
      roleId: 'role-1',
      roleName: 'VENDOR_ADMIN',
      permissions: ['cms_profile:manage'],
      name: 'Vendor',
      email: 'vendor@example.com',
      accountStatus: 'ACTIVE',
      language: 'ARABIC',
      theme: 'DARK',
    },
  };

  function signIn(): void {
    auth.login.mockReturnValue(of(response));
    component.loginForm.patchValue({ email: response.vendorAccount.email, password: 'Password1!' });
    component.login();
  }

  it('holds the session until the OTP is entered', () => {
    signIn();

    expect(component.pendingLogin()).toBe(response);
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  function failSignIn(status: number, body: object): void {
    auth.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: body })));
    component.loginForm.patchValue({ email: 'vendor@example.com', password: 'WrongPass1!' });
    component.login();
  }

  it('shows the attempts left after a wrong password', () => {
    failSignIn(401, { message: 'Invalid credentials', attemptsRemaining: 4 });

    expect(component.notice()).toBe('login.invalidCredentialsAttempts');
    expect(component.noticeParams()).toEqual({ count: 4 });
  });

  it('shows the minutes left when the account is locked', () => {
    failSignIn(423, { lockedUntil: new Date(Date.now() + 14.5 * 60_000).toISOString(), attemptsRemaining: 0 });

    expect(component.notice()).toBe('login.accountLocked');
    expect(component.noticeParams()).toEqual({ minutes: 15 });
  });

  it('rejects a wrong OTP', () => {
    signIn();
    component.otpForm.setValue({ code: '123456' });
    component.verifyOtp();

    expect(component.notice()).toBe('login.otpInvalid');
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('applies the vendor saved language and theme after the OTP', async () => {
    signIn();
    component.otpForm.setValue({ code: '111111' });
    component.verifyOtp();
    await fixture.whenStable();

    expect(auth.setSession).toHaveBeenCalledWith('token', response.vendorAccount);
    expect(theme.setAppearanceMode).toHaveBeenCalledWith('dark');
    expect(i18n.setLang).toHaveBeenCalledWith('ar');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
