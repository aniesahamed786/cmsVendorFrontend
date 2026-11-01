import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Category } from '../../services/get-categories.service';
import { PrimeUIModules } from '../../../core/prime.import';
import { InfoTip } from '../info-tip/info-tip';

@Component({
  selector: 'app-category-dropdown',
  imports: [ReactiveFormsModule, FormsModule, PrimeUIModules, InfoTip],
  templateUrl: './category-dropdown.html',
  styleUrl: './category-dropdown.css',
})
export class CategoryDropdownComponent {
  @Input() label: string = 'Select Category';
  @Input() placeholder: string = 'Select category';
  @Input() multiple: boolean = false;
  @Input() required: boolean = false;
  /** Optional already-translated help text; renders an <app-info-tip> next to the label. */
  @Input() tooltip?: string;
  @Input() control!: FormControl;
  /** Vendor-scoped categories supplied by the owning form. */
  @Input() categories: Category[] = [];
}
