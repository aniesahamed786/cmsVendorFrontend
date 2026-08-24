import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { BranchViewField } from '../../models/request-entity-view.mapper';

@Component({
  selector: 'app-request-branch-detail',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './request-branch-detail.html',
  styleUrl: './request-branch-detail.scss',
})
export class RequestBranchDetail {
  readonly fields = input.required<BranchViewField[]>();

  isFullWidthField(key: string): boolean {
    return ['address', 'link', 'branchRepresentativeName', 'branchPhoneNumber'].includes(key);
  }

  getSocialLinkUrl(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value && typeof value === 'object' && typeof (value as any).url === 'string') {
      return (value as any).url.trim();
    }
    return '';
  }

  getExternalLinkHref(value: unknown): string {
    const url = this.getSocialLinkUrl(value);
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
}
