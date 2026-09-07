import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';

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

  it('applies the vendor saved language and theme after login', async () => {
    const response: LoginResponse = {
      accessToken: 'token',
      vendorAccount: {
        id: 'account-1',
        vendorId: 'vendor-1',
        roleId: 'role-1',
        name: 'Vendor',
        email: 'vendor@example.com',
        accountStatus: 'ACTIVE',
        language: 'ARABIC',
        theme: 'DARK',
      },
    };
    auth.login.mockReturnValue(of(response));
    component.loginForm.patchValue({ email: response.vendorAccount.email, password: 'Password1!' });

    component.login();
    await fixture.whenStable();

    expect(auth.setSession).toHaveBeenCalledWith('token', response.vendorAccount);
    expect(theme.setAppearanceMode).toHaveBeenCalledWith('dark');
    expect(i18n.setLang).toHaveBeenCalledWith('ar');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
