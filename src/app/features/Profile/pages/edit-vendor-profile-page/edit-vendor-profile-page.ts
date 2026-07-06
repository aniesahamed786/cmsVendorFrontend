import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PrimeUIModules } from '../../../../core/prime.import';
import { VendorProfileEditForm } from '../../components/vendor-profile-edit-form/vendor-profile-edit-form';
import { VendorPreview } from '../../components/vendor-preview/vendor-preview';
import { MOCK_VENDOR_PROFILE_EDIT } from '../../data/mock-vendor-profile-edit';
import { VendorProfileEditData } from '../../models/vendor-profile-edit.model';

@Component({
  selector: 'app-edit-vendor-profile-page',
  imports: [CommonModule, PrimeUIModules, VendorProfileEditForm, VendorPreview],
  templateUrl: './edit-vendor-profile-page.html',
  styleUrl: './edit-vendor-profile-page.css',
  providers: [MessageService],
})
export class EditVendorProfilePage {
  @ViewChild('editForm') editForm?: VendorProfileEditForm;
  @ViewChild('preview') preview?: VendorPreview;

  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly initialData = signal(MOCK_VENDOR_PROFILE_EDIT);
  readonly isLoading = signal(false);

  goBack(): void {
    this.router.navigate(['/profile']);
  }

  onSaveDraft(payload: VendorProfileEditData): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Draft saved',
      detail: 'Your profile changes were saved as draft.',
      life: 2200,
    });
  }

  onUpdateChanges(payload: VendorProfileEditData): void {
    this.isLoading.set(true);
    this.initialData.set(payload);
    this.messageService.add({
      severity: 'success',
      summary: 'Profile updated',
      detail: 'Vendor profile changes were updated successfully.',
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
}
