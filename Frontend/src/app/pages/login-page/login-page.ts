import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type UserRole = 'student' | 'recruiter' | 'tpo';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TitleCasePipe],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected selectedRole = signal<UserRole>('student');
  protected email = '';
  protected password = '';
  protected showPassword = false;
  protected isLoading = false;
  protected rememberMe = false;
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);
  protected tpoSuggestions = signal<any[]>([]);
  protected isOnHold = signal<boolean>(false);
  protected holdFeedback = signal<string>('');
  protected holdSuggestions = signal<string>('');
  protected holdCompanyName = signal<string>('');

  // Forgot password flow states
  protected isForgotModalOpen = signal<boolean>(false);
  protected forgotEmail = '';
  protected resetCode = '';
  protected resetNewPassword = '';
  protected forgotStep = signal<number>(1);
  protected forgotIsLoading = signal<boolean>(false);
  protected forgotError = signal<string | null>(null);
  protected forgotSuccess = signal<string | null>(null);

  private particleInterval?: ReturnType<typeof setInterval>;

  readonly roles: { id: UserRole; label: string; icon: string; desc: string }[] = [
    { id: 'student', label: 'Student', icon: 'school', desc: 'Access your placement profile' },
    { id: 'recruiter', label: 'Recruiter', icon: 'corporate_fare', desc: 'Manage hiring campaigns' },
    { id: 'tpo', label: 'TPO', icon: 'admin_panel_settings', desc: 'Oversee campus drives' },
  ];

  protected googleClientId = signal<string | null>(null);

  ngOnInit(): void {
    // 1. Auto-redirect if session/token already exists
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = (user.role || '').toLowerCase();
        if (role === 'tpo') {
          this.router.navigate(['/tpo/dashboard']);
          return;
        } else if (role === 'recruiter') {
          this.router.navigate(['/recruiter/dashboard']);
          return;
        } else if (role === 'student') {
          this.router.navigate(['/student/dashboard']);
          return;
        }
      } catch (e) {
        console.error('Error auto-redirecting on init:', e);
      }
    }

    // 2. Pre-fill email/role if "Remember me" was checked on last login
    const rememberedEmail = localStorage.getItem('remembered_email');
    const rememberedRole = localStorage.getItem('remembered_role');
    if (rememberedEmail) {
      this.email = rememberedEmail;
      this.rememberMe = true;
      if (rememberedRole) {
        this.selectedRole.set(rememberedRole as UserRole);
      }
    }

    // 3. Check for reapproval success message query param
    this.route.queryParams.subscribe((params) => {
      if (params['reapprovalSuccess'] === 'true') {
        this.successMessage.set('Your company profile update and re-approval request have been submitted successfully. The TPO will review it shortly.');
        this.selectedRole.set('recruiter');
        // Clear query parameters
        this.router.navigate([], {
          queryParams: { reapprovalSuccess: null },
          queryParamsHandling: 'merge'
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.spawnParticles();
    this.initReveal();
    this.fetchGoogleClientId();
  }

  private fetchGoogleClientId(): void {
    this.http.get<any>('http://localhost:5000/api/auth/google/client-id').subscribe({
      next: (res) => {
        if (res.clientId) {
          this.googleClientId.set(res.clientId);
          this.loadGoogleScript(res.clientId);
        }
      },
      error: () => {
        // Fallback silently if backend is offline or route not configured
      }
    });
  }

  private loadGoogleScript(clientId: string): void {
    if (document.getElementById('google-gsi-client')) {
      this.initializeGoogleSignIn(clientId);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.initializeGoogleSignIn(clientId);
    };
    document.body.appendChild(script);
  }

  private initializeGoogleSignIn(clientId: string): void {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => this.handleGoogleCredential(response),
      });
      google.accounts.id.renderButton(
        document.getElementById('real-google-btn-container'),
        { theme: 'outline', size: 'large', width: 280 }
      );
    }
  }

  protected handleGoogleCredential(response: any): void {
    this.isGoogleLoggingIn = true;
    this.errorMessage.set(null);

    this.http.post<any>('http://localhost:5000/api/auth/google', {
      token: response.credential,
    }).subscribe({
      next: (res) => {
        this.isGoogleLoggingIn = false;
        const storage = this.rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', res.token);
        storage.setItem('user', JSON.stringify(res.user));

        if (this.rememberMe) {
          localStorage.setItem('remembered_email', res.user.email || '');
          localStorage.setItem('remembered_role', this.selectedRole());
        } else {
          localStorage.removeItem('remembered_email');
          localStorage.removeItem('remembered_role');
        }

        const role = (res.user.role || '').toLowerCase();
        if (role === 'tpo') {
          this.router.navigate(['/tpo/dashboard']);
        } else if (role === 'recruiter') {
          this.router.navigate(['/recruiter/dashboard']);
        } else if (role === 'student') {
          this.router.navigate(['/student/dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.isGoogleLoggingIn = false;
        const errBody = err.error || {};
        const msg = errBody.message || 'Google Sign-In failed.';
        this.errorMessage.set(msg);
        if (errBody.tpoSuggestions && Array.isArray(errBody.tpoSuggestions)) {
          this.tpoSuggestions.set(errBody.tpoSuggestions);
        } else {
          this.tpoSuggestions.set([]);
        }
      }
    });
  }

  private initReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible');
        });
      },
      { threshold: 0.1 }
    );
    this.elRef.nativeElement
      .querySelectorAll('.reveal')
      .forEach((el: Element) => observer.observe(el));
  }

  private spawnParticles(): void {
    const container = this.elRef.nativeElement.querySelector('.login-particles');
    if (!container) return;

    const spawn = () => {
      const p = document.createElement('span');
      p.className = 'particle';
      const size = Math.random() * 6 + 3;
      p.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${Math.random() * 100}%;
        animation-duration: ${Math.random() * 8 + 6}s;
        animation-delay: ${Math.random() * 2}s;
        opacity: ${Math.random() * 0.4 + 0.1};
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), 16000);
    };

    for (let i = 0; i < 12; i++) setTimeout(spawn, i * 300);
    this.particleInterval = setInterval(spawn, 1200);
  }

  protected selectRole(role: UserRole): void {
    this.selectedRole.set(role);
    this.email = '';
    this.password = '';
    this.errorMessage.set(null);
  }

  protected get isEmailValid(): boolean {
    if (!this.email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  protected get pwdHasMinLength(): boolean {
    return this.password.length >= 8;
  }

  protected get pwdHasUpper(): boolean {
    return /[A-Z]/.test(this.password);
  }

  protected get pwdHasLower(): boolean {
    return /[a-z]/.test(this.password);
  }

  protected get pwdHasNumber(): boolean {
    return /[0-9]/.test(this.password);
  }

  protected get pwdHasSpecial(): boolean {
    return /[^A-Za-z0-9]/.test(this.password);
  }

  protected get isPasswordValid(): boolean {
    if (!this.password) return true;
    return this.selectedRole() === 'student' || this.pwdHasMinLength;
  }

  protected get isFormValid(): boolean {
    return Boolean(
      this.email.trim() &&
      this.isEmailValid &&
      this.password.trim() &&
      (this.selectedRole() === 'student' || this.pwdHasMinLength)
    );
  }

  protected isGoogleLoggingIn = false;

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  protected onSubmit(): void {
    if (!this.email || !this.password) return;
    this.isLoading = true;
    this.errorMessage.set(null);

    this.http.post<any>('http://localhost:5000/api/auth/login', {
      email: this.email,
      password: this.password,
    }).subscribe({
      next: (res) => {
        this.isLoading = false;

        const storage = this.rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', res.token);
        storage.setItem('user', JSON.stringify(res.user));

        if (this.rememberMe) {
          localStorage.setItem('remembered_email', this.email);
          localStorage.setItem('remembered_role', this.selectedRole());
        } else {
          localStorage.removeItem('remembered_email');
          localStorage.removeItem('remembered_role');
        }

        const role = (res.user.role || this.selectedRole()).toLowerCase();

        if (role === 'tpo') {
          this.router.navigate(['/tpo/dashboard']);
        } else if (role === 'recruiter') {
          this.router.navigate(['/recruiter/dashboard']);
        } else if (role === 'student') {
          this.router.navigate(['/student/dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        const errBody = err.error || {};
        const msg = errBody.message || 'Login failed. Please check your credentials.';

        // Handle ON_HOLD status
        if (errBody.status === 'ON_HOLD') {
          this.isOnHold.set(true);
          this.holdFeedback.set(errBody.feedback || '');
          this.holdSuggestions.set(errBody.suggestions || '');
          this.holdCompanyName.set(errBody.companyName || '');
          this.errorMessage.set(null);
          this.tpoSuggestions.set([]);
          
          if (errBody.token) {
            const storage = this.rememberMe ? localStorage : sessionStorage;
            storage.setItem('token', errBody.token);
          }
          return;
        }

        this.isOnHold.set(false);
        this.errorMessage.set(msg);
        if (errBody.tpoSuggestions && Array.isArray(errBody.tpoSuggestions)) {
          this.tpoSuggestions.set(errBody.tpoSuggestions);
        } else {
          this.tpoSuggestions.set([]);
        }
      },
    });
  }

  protected getPlaceholderEmail(): string {
    const map: Record<UserRole, string> = {
      student: 'student@university.edu',
      recruiter: 'hr@company.com',
      tpo: 'tpo@university.edu',
    };
    return map[this.selectedRole()];
  }

  protected getRoleGradient(): string {
    const map: Record<UserRole, string> = {
      student: 'linear-gradient(135deg, #003b5a 0%, #006497 60%, #0080c0 100%)',
      recruiter: 'linear-gradient(135deg, #1a3a5c 0%, #0f5986 60%, #0074a8 100%)',
      tpo: 'linear-gradient(135deg, #0a2d45 0%, #004f7a 60%, #006fa0 100%)',
    };
    return map[this.selectedRole()];
  }

  protected openForgotModal(): void {
    this.forgotEmail = '';
    this.resetCode = '';
    this.resetNewPassword = '';
    this.forgotStep.set(1);
    this.forgotError.set(null);
    this.forgotSuccess.set(null);
    this.isForgotModalOpen.set(true);
  }

  protected closeForgotModal(): void {
    this.isForgotModalOpen.set(false);
  }

  protected submitForgotEmail(): void {
    if (!this.forgotEmail.trim()) return;
    this.forgotIsLoading.set(true);
    this.forgotError.set(null);
    this.forgotSuccess.set(null);

    this.http.post<any>('http://localhost:5000/api/auth/forgot-password', {
      email: this.forgotEmail.trim()
    }).subscribe({
      next: (res) => {
        this.forgotIsLoading.set(false);
        this.forgotStep.set(2);
        this.forgotSuccess.set('Reset code has been sent! Check your server console (and response body in local testing).');
        // Pre-fill reset code for frictionless development
        if (res.code) {
          this.resetCode = res.code;
        }
      },
      error: (err) => {
        this.forgotIsLoading.set(false);
        this.forgotError.set(err.error?.message || 'Failed to send reset code.');
      }
    });
  }

  protected submitResetPassword(): void {
    if (!this.forgotEmail.trim() || !this.resetCode.trim() || !this.resetNewPassword.trim()) return;
    this.forgotIsLoading.set(true);
    this.forgotError.set(null);
    this.forgotSuccess.set(null);

    this.http.post<any>('http://localhost:5000/api/auth/reset-password', {
      email: this.forgotEmail.trim(),
      code: this.resetCode.trim(),
      newPassword: this.resetNewPassword.trim()
    }).subscribe({
      next: (res) => {
        this.forgotIsLoading.set(false);
        this.closeForgotModal();
        this.successMessage.set('Password reset successfully. You can now login with your new password.');
        this.password = ''; // Clear password field
      },
      error: (err) => {
        this.forgotIsLoading.set(false);
        this.forgotError.set(err.error?.message || 'Failed to reset password.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.particleInterval) clearInterval(this.particleInterval);
  }
}
