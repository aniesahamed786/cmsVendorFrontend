import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

@Pipe({
  name: 'translate',
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    // Read both signals so change detection re-runs this on language switch.
    this.i18n.lang();
    this.i18n.loadSeq();
    return this.i18n.t(key, params);
  }
}
