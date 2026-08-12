import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../../core/services/auth.service';
import { Button } from '../../../shared/Components/button/button';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    Button,
    TranslatePipe
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  private readonly i18n = inject(I18nService);

  loginForm: FormGroup;

  isSubmitting = false;

 constructor(
  private fb: FormBuilder,
  private authService: AuthService,
  private router: Router
) {

    this.loginForm = this.fb.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ],

      remember: [false]
    });

  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  /** Login is pre-shell, so this is the only language switch an Arabic user can reach. */
  toggleLanguage(): void {
    void this.i18n.toggle();
  }

  login(): void {

  if (this.loginForm.invalid) {
    this.loginForm.markAllAsTouched();
    return;
  }

  const payload = {
    email: this.loginForm.value.email,
    password: this.loginForm.value.password
  };

  console.log('Request Payload:', payload);

  this.authService.login(payload).subscribe({

    next: (response) => {

      console.log('Login Success:', response);

      localStorage.setItem('accessToken', response.accessToken);

      localStorage.setItem(
        'vendorAccount',
        JSON.stringify(response.vendorAccount)
      );

      this.router.navigate(['/dashboard']);

    },

    error: (error) => {

      console.error('Login Failed:', error);

      alert(this.i18n.t('login.invalidCredentials'));

    }

  });

}

}