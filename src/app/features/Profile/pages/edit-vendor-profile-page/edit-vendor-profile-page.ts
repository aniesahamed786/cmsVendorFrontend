import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PrimeUIModules } from '../../../../core/prime.import';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { VendorProfileEditForm } from '../../components/vendor-profile-edit-form/vendor-profile-edit-form';
import { VendorPreview } from '../../components/vendor-preview/vendor-preview';
import { Button } from '../../../../shared/Components/button/button';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import { VendorProfileEditData } from '../../models/vendor-profile-edit.model';

@Component({
  selector: 'app-edit-vendor-profile-page',
  imports: [CommonModule, PrimeUIModules, VendorProfileEditForm, VendorPreview, Button, TranslatePipe],
  templateUrl: './edit-vendor-profile-page.html',
  styleUrl: './edit-vendor-profile-page.css',
  providers: [MessageService],
})
export class EditVendorProfilePage {
  @ViewChild('editForm') editForm?: VendorProfileEditForm;
  @ViewChild('preview') preview?: VendorPreview;

  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);

  readonly initialData = signal(MOCK_VENDOR_PROFILE_EDIT);
  readonly isLoading = signal(false);

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  onSaveDraft(payload: VendorProfileEditData): void {
    this.messageService.add({
      severity: 'info',
      summary: this.i18n.t('profile.toast.draftSavedSummary'),
      detail: this.i18n.t('profile.toast.draftSavedDetail'),
      life: 2200,
    });
  }

  onUpdateChanges(payload: VendorProfileEditData): void {
    this.isLoading.set(true);
    this.initialData.set(payload);
    this.messageService.add({
      severity: 'success',
      summary: this.i18n.t('profile.toast.updatedSummary'),
      detail: this.i18n.t('profile.toast.updatedDetail'),
      life: 2200,
    });
    this.isLoading.set(false);
    this.router.navigate(['/profile']);
  }

  triggerSaveDraft(): void {
    this.editForm?.onSaveDraft();
  }

  triggerUpdateChanges(): void {
    this.editForm?.onUpdateChanges();
  }

  onLanguageFocus(lang: 'en' | 'ar'): void {
    if (this.preview) {
      this.preview.setLanguage(lang);
    }
  }

  onFieldFocus(event: FocusEvent): void {
    const el = (event.target as HTMLElement).closest('[formControlName],[data-preview-section]');
    if (!el) return;
    // rep* fields have no preview counterpart; every other business field maps to identity
    const section =
      el.getAttribute('data-preview-section') ??
      (el.getAttribute('formControlName')?.startsWith('rep') ? null : 'identity');
    if (section) {
      this.preview?.scrollToSection('preview-section-' + section);
    }
  }
}
