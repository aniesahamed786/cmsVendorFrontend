import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProfileSettingsService } from './profile-settings.service';

describe('ProfileSettingsService', () => {
  it('persists vendor language and theme preferences', () => {
    TestBed.configureTestingModule({
      providers: [ProfileSettingsService, provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(ProfileSettingsService);
    const http = TestBed.inject(HttpTestingController);

    service.updateSettings({ language: 'ARABIC', theme: 'DARK' }).subscribe();

    const request = http.expectOne(
      `${environment.backendUrl}${environment.apiBaseUrl}/profile-settings`,
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ language: 'ARABIC', theme: 'DARK' });
    request.flush({});
    http.verify();
  });
});
