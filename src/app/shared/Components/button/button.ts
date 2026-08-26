import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  variant = input<'primary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost' | 'danger-outline' | 'ghost-danger'>('primary');
  type = input<'button' | 'submit'>('button');
  disabled = input(false);
  loading = input(false); // shows a spinner and blocks clicks during async work
  icon = input<string>(); // optional PrimeIcons class, e.g. 'pi pi-pencil'
}
