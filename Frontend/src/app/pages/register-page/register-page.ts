import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  // ── Form Model ───────────────────────────────────────────────────────────────
  protected companyName = '';
  protected officialEmail = '';
  protected website = '';
  protected coverNote = '';
  protected contactPerson = '';
  protected phoneNumber = '';
  protected password = '';
  protected confirmPassword = '';
  protected agreeTerms = false;

  // ── UI state ─────────────────────────────────────────────────────────────────
  protected showPassword = false;
  protected showConfirmPassword = false;
  protected isLoading = false;
  protected submitSuccess = false;
  protected errorMessage: string | null = null;
  protected emailAlreadyExists = false;

  protected onEmailInput(): void {
    this.emailAlreadyExists = false;
    if (this.errorMessage && (this.errorMessage.includes('email') || this.errorMessage.includes('exists'))) {
      this.errorMessage = null;
    }
  }

  private particleInterval?: ReturnType<typeof setInterval>;

  // ── Password strength (Dynamic Getter) ───────────────────────────────────────
  protected get passwordStrength(): number {
    const p = this.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  }

  protected get strengthLabel(): string {
    const score = this.passwordStrength;
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || 'Weak';
  }

  protected get strengthColor(): string {
    const score = this.passwordStrength;
    return ['', '#e53935', '#fb8c00', '#f9a825', '#43a047'][score] || '#e53935';
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  protected get isFormValid(): boolean {
    return (
      this.companyName.trim().length > 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.officialEmail.trim()) &&
      this.websiteValid &&
      this.contactPerson.trim().length > 1 &&
      this.coverNote.trim().length >= 20 &&
      this.phoneNumber.trim().startsWith('+') &&
      this.phoneNumber.trim().length >= 12 &&
      this.password.length >= 8 &&
      this.password === this.confirmPassword &&
      this.agreeTerms
    );
  }

  /** Per-condition checklist shown near the submit button */
  protected get validationItems(): { label: string; met: boolean }[] {
    return [
      { label: 'Company name entered', met: this.companyName.trim().length > 1 },
      { label: 'Valid official email', met: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.officialEmail.trim()) },
      { label: 'Valid official website URL', met: this.websiteValid },
      { label: 'Contact person name entered', met: this.contactPerson.trim().length > 1 },
      { label: 'Cover Note / Introduction Letter written (min 20 chars)', met: this.coverNote.trim().length >= 20 },
      { label: 'Phone number with + country code (min 12 chars e.g. +919876543210)', met: this.phoneNumber.trim().startsWith('+') && this.phoneNumber.trim().length >= 12 },
      { label: 'Password is at least 8 characters', met: this.password.length >= 8 },
      { label: 'Passwords match', met: this.password.length > 0 && this.password === this.confirmPassword },
      { label: 'Terms & conditions accepted', met: this.agreeTerms },
    ];
  }

  protected get emailValid(): boolean {
    return !this.officialEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.officialEmail.trim());
  }

  protected get websiteValid(): boolean {
    const w = this.website.trim();
    if (!w) return false;
    return /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i.test(w);
  }

  protected get phoneValid(): boolean {
    if (!this.phoneNumber.trim()) return true;
    const p = this.phoneNumber.trim();
    return p.startsWith('+') && p.length >= 12 && /^\+[0-9\s-]{11,18}$/.test(p);
  }

  protected get passwordHasMinLength(): boolean {
    return this.password.length >= 8;
  }

  protected get passwordHasUpper(): boolean {
    return /[A-Z]/.test(this.password);
  }

  protected get passwordHasNumber(): boolean {
    return /[0-9]/.test(this.password);
  }

  protected get passwordHasSpecial(): boolean {
    return /[^A-Za-z0-9]/.test(this.password);
  }

  protected get passwordsMatch(): boolean {
    return !this.confirmPassword || this.password === this.confirmPassword;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.spawnParticles();
  }

  private spawnParticles(): void {
    const container = this.elRef.nativeElement.querySelector('.reg-particles');
    if (!container) return;
    const spawn = () => {
      const p = document.createElement('span');
      p.className = 'particle';
      const size = Math.random() * 6 + 3;
      p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;animation-duration:${Math.random() * 8 + 6}s;animation-delay:${Math.random() * 2}s;opacity:${Math.random() * 0.4 + 0.1};`;
      container.appendChild(p);
      setTimeout(() => p.remove(), 16000);
    };
    for (let i = 0; i < 14; i++) setTimeout(spawn, i * 280);
    this.particleInterval = setInterval(spawn, 1100);
  }

  protected navigateToDashboard(): void {
    this.router.navigate(['/recruiter/dashboard']);
  }

  private scrollToTop(): void {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      const el = this.elRef.nativeElement;
      const panel = el.querySelector('.reg-panel-right');
      if (panel) { panel.scrollTop = 0; panel.scrollTo({ top: 0, behavior: 'smooth' }); }
      const wrapper = el.querySelector('.form-wrapper');
      if (wrapper) { wrapper.scrollTop = 0; wrapper.scrollTo({ top: 0, behavior: 'smooth' }); }
    } catch (e) {}
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  protected onSubmit(): void {
    if (!this.companyName.trim()) {
      this.errorMessage = 'Please enter your Company Name.';
      this.scrollToTop();
      return;
    }
    if (!this.emailValid || !this.officialEmail.trim()) {
      this.errorMessage = 'Please enter a valid Official Email address.';
      this.scrollToTop();
      return;
    }
    if (!this.contactPerson.trim()) {
      this.errorMessage = 'Please enter Contact Person Name.';
      this.scrollToTop();
      return;
    }
    if (!this.coverNote.trim() || this.coverNote.trim().length < 20) {
      this.errorMessage = 'Please provide a Cover Note / Introduction Letter for the TPO (min 20 characters).';
      this.scrollToTop();
      return;
    }
    if (!this.phoneNumber.trim().startsWith('+') || this.phoneNumber.trim().length < 12) {
      this.errorMessage = 'Please enter a valid Phone Number starting with + and country code (min 12 chars e.g. +919876543210).';
      this.scrollToTop();
      return;
    }
    if (this.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      this.scrollToTop();
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Password and Confirm Password do not match.';
      this.scrollToTop();
      return;
    }
    if (!this.agreeTerms) {
      this.errorMessage = 'Please accept the Terms of Service to proceed.';
      this.scrollToTop();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const payload = {
      name: this.contactPerson.trim(),
      email: this.officialEmail.trim().toLowerCase(),
      password: this.password,
      role: 'Recruiter',
      phone: this.phoneNumber.trim(),
      companyName: this.companyName.trim(),
      coverNote: this.coverNote.trim(),
      website: this.website.trim() || null,
      officialEmail: this.officialEmail.trim().toLowerCase(),
    };

    this.http.post<any>('http://localhost:5000/api/auth/register', payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.submitSuccess = true;
        this.scrollToTop();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.message || '';
        if (err.status === 409 || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
          this.emailAlreadyExists = true;
          this.errorMessage = msg || 'An account with this email address already exists. Please sign in to your account or use a different email.';
        } else {
          this.errorMessage = msg || 'Registration failed. Please check details and try again.';
        }
        this.scrollToTop();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.particleInterval) clearInterval(this.particleInterval);
  }
}
