import { Component, OnInit, signal, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { GetCategoriesService, Category } from '../../services/get-categories.service';
import { PrimeUIModules } from '../../../core/prime.import';

@Component({
  selector: 'app-category-dropdown',
  imports: [ReactiveFormsModule, FormsModule, PrimeUIModules],
  templateUrl: './category-dropdown.html',
  styleUrl: './category-dropdown.css',
})
export class CategoryDropdownComponent implements OnInit {
  @Input() label: string = 'Select Category';
  @Input() placeholder: string = 'Select category';
  @Input() multiple: boolean = false;
  @Input() required: boolean = false;
  @Input() control!: FormControl;

  categories = signal<Category[]>([]);

  constructor(private categoryService: GetCategoriesService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getAllCategories().subscribe({
      next: (res) => {
        // Filter active categories only
        const activeCategories = res
          .filter(cat => cat.isActive !== false)
          .map((cat) => ({
            ...cat,
            id: typeof cat._id === 'string' ? cat._id : cat._id?.$oid,
          }))
          // Ensure we don't feed undefined IDs to the select component (causes "select all" behavior)
          .filter((cat) => typeof cat.id === 'string' && cat.id.trim() !== '');

        this.categories.set(activeCategories);
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        this.categories.set([]);
      },
    });
  }
}
