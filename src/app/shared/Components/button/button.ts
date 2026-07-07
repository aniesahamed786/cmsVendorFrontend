import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class Button {
  variant = input<'primary' | 'outline'>('primary');
  type = input<'button' | 'submit'>('button');
  disabled = input(false);
  icon = input<string>(); // optional PrimeIcons class, e.g. 'pi pi-pencil'
}
