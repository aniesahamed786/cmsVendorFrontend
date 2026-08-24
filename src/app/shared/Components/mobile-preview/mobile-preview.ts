import { Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mobile-preview',
  imports: [CommonModule],
  templateUrl: './mobile-preview.html',
  styleUrl: './mobile-preview.scss',
})
export class MobilePreview {
  language = model<'en' | 'ar'>('en');
  activeNav = input<'home' | 'near-you' | 'search' | 'profile'>('home');
  showStatusBar = input<boolean>(true);
  showTopBar = input<boolean>(true);
  showBottomNav = input<boolean>(true);
  showLanguageToggle = input<boolean>(true);
  ariaLabel = input<string>('Mobile preview');
  time = input<string>('9:41');

  toggleLanguage(): void {
    this.language.set(this.language() === 'en' ? 'ar' : 'en');
  }
}
