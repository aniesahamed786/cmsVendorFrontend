import {
  Component,
  ElementRef,
  HostListener,
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
  placeholder = input<string>('');

  readonly resolvedPlaceholder = computed(() => {
    this.i18n.loadSeq();
    return this.placeholder() || this.i18n.t('common.search');
  });

  isMobileExpanded = signal(false);

  @ViewChild('mobileInput') mobileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('desktopInput') desktopInput?: ElementRef<HTMLInputElement>;

  openMobileSearch(): void {
    this.isMobileExpanded.set(true);
    setTimeout(() => {
      this.mobileInput?.nativeElement?.focus();
    }, 60);
  }

  closeMobileSearch(): void {
    this.isMobileExpanded.set(false);
  }

  clearSearch(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.value.set('');
    this.mobileInput?.nativeElement?.focus();
    this.desktopInput?.nativeElement?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobileExpanded()) {
      this.closeMobileSearch();
    }
  }
}
