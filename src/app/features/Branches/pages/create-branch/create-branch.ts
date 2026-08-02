import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { BranchForm, BranchFormModel } from '../branch-form/branch-form';

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
 
  save(event: BranchFormModel): void {
    console.log('[CreateBranch] Add Store submit values:', event);
    // TODO: wire up to the branches create API once it's available.
    this.router.navigate(['/branches']);
  }
 
  saveDraft(event: Partial<BranchFormModel>): void {
    console.log('[CreateBranch] Save As Draft values:', event);
    // TODO: wire up to the branches draft API once it's available.
    this.router.navigate(['/branches']);
  }
}
