import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';

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
  protected password = signal<string>('');
  protected confirmPassword = signal<string>('');

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

  protected onSubmit(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    // Validate passwords if user attempts to change it
    if (this.password()) {
      if (this.password() !== this.confirmPassword()) {
        this.errorMessage.set('Passwords do not match.');
        return;
      }
      if (this.password().length < 6) {
        this.errorMessage.set('Password must be at least 6 characters long.');
        return;
      }
    }

    this.isSaving.set(true);
    const formData = new FormData();
    formData.append('officialEmail', this.officialEmail());
    formData.append('website', this.website());
    
    if (this.password()) {
      formData.append('password', this.password());
    }
    if (this.selectedLogoFile) {
      formData.append('logo', this.selectedLogoFile);
    }

    this.recruiterService.updateProfile(formData).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.successMessage.set('Company profile updated successfully!');
        this.password.set('');
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

        // Trigger a window reload or broadcast state if necessary, or just wait.
        // Let's redirect to dashboard or let them stay
        setTimeout(() => {
          this.successMessage.set(null);
        }, 4000);
      },
      error: (err) => {
        console.error('Update profile failed:', err);
        this.errorMessage.set(err.error?.message || 'Failed to update profile. Please try again.');
        this.isSaving.set(false);
      }
    });
  }
}
