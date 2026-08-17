import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Steps: 1 = Email Input, 2 = OTP & New Password Input, 3 = Success
  protected step = signal<1 | 2 | 3>(1);

  // Form Fields
  protected email = signal<string>('');
  protected otpCode = signal<string>('');
  protected newPassword = signal<string>('');
  protected confirmPassword = signal<string>('');

  // UI States
  protected isLoading = signal<boolean>(false);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);
  protected showPassword = signal<boolean>(false);
  protected showConfirmPassword = signal<boolean>(false);

  // Resend Timer
  protected resendCountdown = signal<number>(0);
  private timerInterval?: ReturnType<typeof setInterval>;

  // Password strength computation
  protected get passwordStrength(): number {
    const pw = this.newPassword().trim();
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }

  protected get strengthLabel(): string {
    const score = this.passwordStrength;
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || 'Weak';
  }

  protected get strengthColor(): string {
    const score = this.passwordStrength;
    return ['', '#E74C3C', '#E67E22', '#F1C40F', '#27AE60'][score] || '#E74C3C';
  }

  // Live Validation Getters
  protected get isOtpValid(): boolean {
    const otp = this.otpCode().trim();
    return otp.length === 6 && /^\d+$/.test(otp);
  }

  protected get isPasswordValid(): boolean {
    const pw = this.newPassword();
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  }

  protected get isConfirmPasswordValid(): boolean {
    return this.confirmPassword().length > 0 && this.confirmPassword() === this.newPassword();
  }

  protected get isResetFormValid(): boolean {
    return this.isOtpValid && this.isPasswordValid && this.isConfirmPasswordValid;
  }

  protected requestOtp(): void {
    const emailVal = this.email().trim().toLowerCase();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      this.setTempError('Please enter a valid registered email address.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.http.post<any>('http://localhost:5000/api/auth/forgot-password', { email: emailVal }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.step.set(2);
        this.setTempSuccess(res.message || 'Verification code sent to your email.');
        this.startResendTimer();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.setTempError(err.error?.message || 'Failed to send reset code. Please check your email.');
      },
    });
  }

  protected resendOtp(): void {
    if (this.resendCountdown() > 0 || this.isLoading()) return;
    this.requestOtp();
  }

  private startResendTimer(): void {
    this.resendCountdown.set(60);
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.resendCountdown() <= 1) {
        clearInterval(this.timerInterval);
        this.resendCountdown.set(0);
      } else {
        this.resendCountdown.update((val) => val - 1);
      }
    }, 1000);
  }

  protected resetPasswordSubmit(): void {
    if (!this.isResetFormValid) {
      if (!this.isOtpValid) {
        this.setTempError('Verification code must be exactly 6 digits.');
      } else if (!this.isPasswordValid) {
        this.setTempError('New password does not meet the minimum requirements.');
      } else if (!this.isConfirmPasswordValid) {
        this.setTempError('Passwords do not match.');
      }
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const payload = {
      email: this.email().trim().toLowerCase(),
      code: this.otpCode().trim(),
      newPassword: this.newPassword(),
    };

    this.http.post<any>('http://localhost:5000/api/auth/reset-password', payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.step.set(3);
        this.setTempSuccess(res.message || 'Password reset successfully!');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.setTempError(err.error?.message || 'Failed to reset password. Please check your verification code.');
      },
    });
  }

  private setTempError(msg: string): void {
    this.errorMessage.set(msg);
    setTimeout(() => {
      this.errorMessage.set(null);
    }, 10000);
  }

  private setTempSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 10000);
  }
}
