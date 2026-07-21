import { Component, computed, inject, model, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'app-search',
  imports: [FormsModule],
  templateUrl: './app-search.html',
  styleUrl: './app-search.scss',
})
export class AppSearch {
  private readonly i18n = inject(I18nService);

  value = model<string>('');

  /** Leave unset for the shared "Search" placeholder; pass a translated string to override. */
  placeholder = input<string>('');

  readonly resolvedPlaceholder = computed(() => {
    this.i18n.loadSeq();
    return this.placeholder() || this.i18n.t('common.search');
  });
}
