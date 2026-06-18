import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PrimeUIModules } from '../../../core/prime.import';

@Component({
  selector: 'app-inprogress',
  imports: [CommonModule, PrimeUIModules],
  templateUrl: './inprogress.html',
  styleUrl: './inprogress.css',
})
export class Inprogress {
  title = input<string | undefined>(undefined);

  constructor(private route: ActivatedRoute) {}

  displayTitle(): string {
    const fromInput = this.title();
    if (fromInput !== undefined && fromInput !== '') return fromInput;
    const fromRoute = this.route.snapshot.data['title'] as string | undefined;
    return fromRoute ?? 'This section';
  }
}
