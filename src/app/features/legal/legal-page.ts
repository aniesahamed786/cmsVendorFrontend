import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { BackButton } from '../../shared/Components/back-button/back-button';
import { I18nService } from '../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { resolveStoredImageUrl } from '../../shared/utils/resolve-stored-image-url';

/** GET /cmsVendor/pages/:topic — an unpublished page comes back as empty text, not 404. */
interface LegalPageApi {
  type: 'text' | 'pdf';
  text_en: string;
  text_ar: string;
  pdfUrl_en: string | null;
  pdfUrl_ar: string | null;
}

/**
 * One page for terms / privacy / disclaimer, keyed by the `:topic` route param.
 * Lives outside the main layout: privacy opens from the login footer, all three from settings.
 */
@Component({
  selector: 'app-legal-page',
  imports: [BackButton, TranslatePipe],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
})
export class LegalPage {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);

  readonly topic = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('topic') ?? '')), {
    initialValue: '',
  });

  /** Line widths (%) for the loading placeholder; 0 = a heading bar. */
  readonly skeletonLines = [0, 100, 96, 88, 60, 0, 100, 92, 97, 70, 100, 84, 45];

  readonly loading = signal(true);
  readonly error = signal(false);

  readonly page = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      switchMap((p) => {
        this.loading.set(true);
        this.error.set(false);
        return this.http
          .get<LegalPageApi>(`${environment.backendUrl}${environment.apiBaseUrl}/pages/${p.get('topic')}`)
          .pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          );
      }),
      map((page) => {
        this.loading.set(false);
        return page;
      }),
    ),
    { initialValue: null },
  );

  readonly html = computed(() => {
    const p = this.page();
    return (this.i18n.isRtl() ? p?.text_ar : p?.text_en) || '';
  });

  /**
   * Trusted as-is so the editor's inline styles survive — same as OfferApp's legal pages.
   * Only admins write these pages (PagesAdminController), so the source is trusted.
   */
  readonly trustedHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.html()));

  readonly pdfHref = computed(() => {
    const p = this.page();
    return resolveStoredImageUrl(this.i18n.isRtl() ? p?.pdfUrl_ar : p?.pdfUrl_en);
  });

  readonly pdfSrc = computed(() => {
    const href = this.pdfHref();
    return href ? this.sanitizer.bypassSecurityTrustResourceUrl(href) : null;
  });

  readonly hasContent = computed(() => (this.page()?.type === 'pdf' ? !!this.pdfHref() : !!this.html()));

  goBack(): void {
    void this.router.navigate([this.auth.isAuthenticated() ? '/settings' : '/login']);
  }
}
