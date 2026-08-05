import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { BranchForm, BranchFormSubmit } from '../branch-form/branch-form';

@Component({
  selector: 'app-create-branch',
  imports: [
    CommonModule,
    BranchForm,
    TranslatePipe
  ],
  templateUrl: './create-branch.html',
  styleUrl: './create-branch.scss',
})
export class CreateBranch {
constructor(private readonly router: Router) {}
 
  save(event: BranchFormSubmit): void {
    console.log('[CreateBranch] Add Store submit values:', event);
    // TODO: raise a STORE/CREATE request (POST /cmsVendor/requests) the way create-offer
    // does, sending event.requestSummary as the request title.
    this.router.navigate(['/branches']);
  }

  saveDraft(event: BranchFormSubmit): void {
    console.log('[CreateBranch] Save As Draft values:', event);
    // TODO: same as save(), with actionType 'DRAFT'.
    this.router.navigate(['/branches']);
  }
}
