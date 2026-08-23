import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { Button } from '../button/button';

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [CommonModule, Button, TranslatePipe],
  templateUrl: './app-bottom-sheet.html',
  styleUrl: './app-bottom-sheet.scss',
})
export class AppBottomSheet {
  private readonly i18n = inject(I18nService);

  visible = model<boolean>(false);
  title = input<string>('');
  activeFilterCount = input<number>(0);
  showClear = input<boolean>(true);
  clearLabel = input<string>('');
  applyLabel = input<string>('');
  maxHeight = input<string>('85vh');

  closed = output<void>();
  cleared = output<void>();
  applied = output<void>();

  @ViewChild('sheetEl') sheetEl?: ElementRef<HTMLElement>;

  readonly resolvedTitle = computed(() => {
    this.i18n.loadSeq();
    return this.title() || this.i18n.t('common.filters');
  });

  readonly resolvedClearLabel = computed(() => {
    this.i18n.loadSeq();
    return this.clearLabel() || this.i18n.t('common.clear');
  });

  readonly resolvedApplyLabel = computed(() => {
    this.i18n.loadSeq();
    return this.applyLabel() || this.i18n.t('common.apply');
  });

  // Drag state
  isDragging = signal(false);
  dragTranslateY = signal(0);
  isClosing = signal(false);

  private startY = 0;
  private currentY = 0;
  private startTime = 0;

  constructor() {
    // Body scroll lock effect
    effect(() => {
      if (this.visible()) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        this.dragTranslateY.set(0);
        this.isClosing.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.close();
    }
  }

  close(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    setTimeout(() => {
      this.visible.set(false);
      this.isClosing.set(false);
      this.dragTranslateY.set(0);
      this.closed.emit();
    }, 220);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onClear(): void {
    this.cleared.emit();
  }

  onApply(): void {
    this.applied.emit();
    this.close();
  }

  // Pointer / Touch drag events
  onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.startDrag(touch.clientY);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging()) return;
    const touch = event.touches[0];
    this.updateDrag(touch.clientY);
  }

  onTouchEnd(): void {
    if (!this.isDragging()) return;
    this.endDrag();
  }

  onMouseDown(event: MouseEvent): void {
    // Only left button
    if (event.button !== 0) return;
    this.startDrag(event.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      this.updateDrag(moveEvent.clientY);
    };

    const onMouseUp = () => {
      this.endDrag();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private startDrag(clientY: number): void {
    this.startY = clientY;
    this.currentY = clientY;
    this.startTime = Date.now();
    this.isDragging.set(true);
  }

  private updateDrag(clientY: number): void {
    this.currentY = clientY;
    const delta = Math.max(0, this.currentY - this.startY);
    this.dragTranslateY.set(delta);
  }

  private endDrag(): void {
    this.isDragging.set(false);
    const delta = Math.max(0, this.currentY - this.startY);
    const elapsedTime = Date.now() - this.startTime;
    const velocity = delta / Math.max(1, elapsedTime); // px per ms

    // If dragged down > 70px or fast swipe down (> 0.5 px/ms)
    if (delta > 70 || velocity > 0.5) {
      this.close();
    } else {
      // Snap back
      this.dragTranslateY.set(0);
    }
  }
}
