import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  loginForm: FormGroup;

  hidePassword = true;

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

  togglePassword(): void {
    this.hidePassword = !this.hidePassword;
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

      alert('Invalid Email or Password');

    }

  });

}

}