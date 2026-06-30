import { Component, Input } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../core/prime.import';

type TargetAudienceOption = { label: string; value: string };

@Component({
  selector: 'app-target-audience-dropdown',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, PrimeUIModules],
  templateUrl: './target-audience-dropdown.html',
  styleUrl: './target-audience-dropdown.css',
})
export class TargetAudienceDropdownComponent {
  @Input() label = 'Target Audience';
  @Input() placeholder = 'Select target audience';
  @Input() required = false;
  @Input() control!: FormControl<string[]>;

  readonly options: TargetAudienceOption[] = [
    { label: 'Employees', value: 'Employees' },
    { label: 'Retirees', value: 'Retirees' },
    { label: 'Dependents', value: 'Dependents' },
  ];
}

