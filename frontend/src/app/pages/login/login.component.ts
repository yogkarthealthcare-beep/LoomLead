import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  isRegisterMode: boolean = false;
  isLoading: boolean = false;
  isDemoLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  returnUrl: string = '/dashboard';

  // Login form model
  loginData = {
    email: '',
    password: ''
  };

  // Register form model
  registerData = {
    name: '',
    email: '',
    password: '',
    company_name: '',
    phone: '',
    industry: 'Real Estate'
  };

  industries: string[] = [
    'Real Estate',
    'Digital Marketing & Web Agency',
    'Healthcare & Dental Clinics',
    'Coaching & Education',
    'Fitness & Gyms',
    'Chartered Accountants & Legal',
    'B2B Services & Consulting',
    'General Sales'
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // If already authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
      if (params['mode'] === 'register') {
        this.isRegisterMode = true;
      }
    });
  }

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  onLogin(): void {
    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginData).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Login failed. Please check your credentials.';
      }
    });
  }

  onRegister(): void {
    if (!this.registerData.name || !this.registerData.email || !this.registerData.password || !this.registerData.company_name) {
      this.errorMessage = 'Please fill in all required fields (Name, Email, Password, Company).';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = 'Account created successfully! Entering your workspace...';
        setTimeout(() => {
          this.router.navigateByUrl('/dashboard');
        }, 800);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }

  onTryDemo(): void {
    this.isDemoLoading = true;
    this.errorMessage = '';

    this.authService.loginDemo().subscribe({
      next: (res) => {
        this.isDemoLoading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.isDemoLoading = false;
        this.errorMessage = 'Could not start demo session. Please try again.';
      }
    });
  }

  fillQuickLogin(email: string): void {
    this.isRegisterMode = false;
    this.loginData.email = email;
    this.loginData.password = 'password123';
  }
}
