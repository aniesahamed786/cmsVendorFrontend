import { Component, model, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  imports: [FormsModule],
  templateUrl: './app-search.html',
  styleUrl: './app-search.scss',
})
export class AppSearch {
  value = model<string>('');
  placeholder = input<string>('Search');
}
