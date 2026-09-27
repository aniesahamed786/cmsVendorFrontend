import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PrimeUIModules } from '../../../core/prime.import';
import { Button } from '../button/button';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'app-access-denied',
  imports: [PrimeUIModules, TranslatePipe, Button],
  templateUrl: './access-denied.html',
  styleUrl: './access-denied.css',
})
export class AccessDenied {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  /** `?reason=vendor_staff` → "Vendor Staff", so the user knows which page was refused. */
  readonly reason = computed(() => {
    this.i18n.lang();
    const raw = this.params()?.get('reason') ?? '';
    if (!raw) return '';
    const key = `accessDenied.resource.${raw}`;
    // t() echoes the key back when it's missing — fall back to the prettified slug.
    const text = this.i18n.t(key);
    return text === key ? raw.replace(/_/g, ' ') : text;
  });

  readonly roleLabel = this.auth.displayRole;

  goHome(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
