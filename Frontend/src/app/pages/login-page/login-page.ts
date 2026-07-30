import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type UserRole = 'student' | 'recruiter' | 'tpo';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TitleCasePipe],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected selectedRole = signal<UserRole>('student');
  protected email = '';
  protected password = '';
  protected showPassword = false;
  protected isLoading = false;
  protected rememberMe = false;
  protected errorMessage = signal<string | null>(null);
  protected tpoSuggestions = signal<any[]>([]);

  private particleInterval?: ReturnType<typeof setInterval>;

  readonly roles: { id: UserRole; label: string; icon: string; desc: string }[] = [
    { id: 'student', label: 'Student', icon: 'school', desc: 'Access your placement profile' },
    { id: 'recruiter', label: 'Recruiter', icon: 'corporate_fare', desc: 'Manage hiring campaigns' },
    { id: 'tpo', label: 'TPO', icon: 'admin_panel_settings', desc: 'Oversee campus drives' },
  ];

  ngAfterViewInit(): void {
    this.spawnParticles();
    this.initReveal();
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

  ngOnDestroy(): void {
    if (this.particleInterval) clearInterval(this.particleInterval);
  }
}
