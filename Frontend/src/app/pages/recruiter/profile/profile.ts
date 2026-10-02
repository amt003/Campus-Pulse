import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { FormControl } from '@angular/forms';
import { meaningfulTextValidator } from '../../../validators/meaningful-text.validator';

@Component({
  selector: 'app-recruiter-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class RecruiterProfileComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly router = inject(Router);

  protected isLoading = signal<boolean>(true);
  protected isSaving = signal<boolean>(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);

  protected companyName = signal<string>('');
  protected officialEmail = signal<string>('');
  protected website = signal<string>('');

  // Security / Password state
  protected currentPassword = signal<string>('');
  protected newPassword = signal<string>('');
  protected confirmPassword = signal<string>('');

  protected showCurrentPassword = signal<boolean>(false);
  protected showNewPassword = signal<boolean>(false);
  protected showConfirmPassword = signal<boolean>(false);

  // Live password attempt check
  protected isPasswordAttempted = computed(() => {
    return (
      this.currentPassword().length > 0 ||
      this.newPassword().length > 0 ||
      this.confirmPassword().length > 0
    );
  });

  // Password Strength Computations
  protected passwordStrength = computed(() => {
    const pw = this.newPassword().trim();
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    return score;
  });

  protected passwordStrengthLabel = computed(() => {
    const score = this.passwordStrength();
    if (score === 0) return '';
    if (score <= 2) return 'Weak';
    if (score === 3) return 'Medium';
    return 'Strong';
  });

  protected passwordStrengthColor = computed(() => {
    const score = this.passwordStrength();
    if (score === 0) return '';
    if (score <= 2) return 'danger';
    if (score === 3) return 'warning';
    return 'success';
  });

  // Live password error validation signals
  protected currentPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return false;
    return !this.currentPassword().trim();
  });

  protected newPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return false;
    const pw = this.newPassword().trim();
    if (!pw) return true;
    return pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw);
  });

  protected confirmPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return false;
    const conf = this.confirmPassword().trim();
    const newPw = this.newPassword().trim();
    if (!conf) return true;
    return conf !== newPw || this.newPasswordError();
  });

  protected currentLogoUrl = signal<string | null>(null);
  protected logoPreviewUrl = signal<string | null>(null);
  private selectedLogoFile: File | null = null;

  ngOnInit(): void {
    this.fetchProfile();
  }

  protected fetchProfile(): void {
    this.isLoading.set(true);
    this.recruiterService.getProfile().subscribe({
      next: (res) => {
        if (res && res.data) {
          const profile = res.data;
          this.companyName.set(profile.companyName || '');
          this.officialEmail.set(profile.officialEmail || '');
          this.website.set(profile.website || '');
          if (profile.companyLogo) {
            this.currentLogoUrl.set(`http://localhost:5000${profile.companyLogo}`);
          } else {
            this.currentLogoUrl.set(null);
          }
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch profile:', err);
        this.errorMessage.set('Failed to load profile details.');
        this.isLoading.set(false);
      }
    });
  }

  protected onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.match(/image\/(png|jpg|jpeg|webp|gif)/)) {
        this.errorMessage.set('Please select a valid image file (PNG, JPG, or WEBP).');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage.set('Image file size cannot exceed 2MB.');
        return;
      }
      this.selectedLogoFile = file;
      this.errorMessage.set(null);

      // Create local preview URL
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreviewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  protected getMeaningfulError(val: string): string | null {
    if (!val || !val.trim()) return null;
    const control = new FormControl(val);
    const errors = meaningfulTextValidator(control);
    if (!errors) return null;
    if (errors['tooFewLetters']) return 'Please enter at least 2 alphabetic characters.';
    if (errors['noVowel']) return "Please enter a meaningful value (e.g., 'Software Engineer').";
    if (errors['keyboardMash']) return 'Please enter a valid, meaningful text without keyboard mash (e.g., asdfghjkl).';
    if (errors['repeatingChars']) return "Please avoid repeating characters (e.g., 'aaaa').";
    return null;
  }

  protected onSubmit(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.companyName() && this.getMeaningfulError(this.companyName())) {
      this.errorMessage.set(`Company Name: ${this.getMeaningfulError(this.companyName())}`);
      return;
    }

    // Validate passwords if user attempts to change it
    if (this.isPasswordAttempted()) {
      if (this.currentPasswordError() || this.newPasswordError() || this.confirmPasswordError()) {
        this.errorMessage.set('Validation failed. Please correct the password fields.');
        return;
      }
    }

    this.isSaving.set(true);
    const formData = new FormData();
    formData.append('officialEmail', this.officialEmail());
    formData.append('website', this.website());
    
    if (this.isPasswordAttempted()) {
      formData.append('password', this.newPassword().trim());
    }
    if (this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }

    this.recruiterService.updateProfile(formData).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.successMessage.set('Company profile updated successfully!');
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        if (res.recruiter && res.recruiter.companyLogo) {
          this.currentLogoUrl.set(`http://localhost:5000${res.recruiter.companyLogo}`);
          this.logoPreviewUrl.set(null);
          this.selectedLogoFile = null;
        }
        
        // Update local session storage if user details changed
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            if (u.recruiter) {
              u.recruiter.officialEmail = this.officialEmail();
              if (res.recruiter && res.recruiter.companyLogo) {
                u.recruiter.companyLogo = res.recruiter.companyLogo;
              }
            }
            if (localStorage.getItem('user')) {
              localStorage.setItem('user', JSON.stringify(u));
            } else {
              sessionStorage.setItem('user', JSON.stringify(u));
            }
          } catch (e) {}
        }

        setTimeout(() => {
          this.successMessage.set(null);
        }, 10000);
      },
      error: (err) => {
        console.error('Update profile failed:', err);
        this.errorMessage.set(err.error?.message || 'Failed to update profile. Please try again.');
        this.isSaving.set(false);
      }
    });
  }
}
