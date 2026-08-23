import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
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

  isMobileExpanded = signal(false);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  openMobileSearch(): void {
    this.isMobileExpanded.set(true);
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 100);
  }

  closeMobileSearch(): void {
    this.isMobileExpanded.set(false);
  }

  clearSearch(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.value.set('');
    this.searchInput?.nativeElement?.focus();
  }
}
