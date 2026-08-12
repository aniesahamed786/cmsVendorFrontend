import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // ThemeService is root-provided but lazy: nothing on /login injected it, so a full
  // page load there stayed unthemed. Injecting here runs it once at bootstrap.
  private readonly theme = inject(ThemeService);
}
