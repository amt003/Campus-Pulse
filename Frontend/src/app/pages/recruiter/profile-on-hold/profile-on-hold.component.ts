import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';

@Component({
  selector: 'app-profile-on-hold',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile-on-hold.component.html',
  styleUrl: './profile-on-hold.component.css'
})
export class ProfileOnHoldComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly router = inject(Router);

  // Form fields
  protected companyName = signal<string>('');
  protected officialEmail = signal<string>('');
  protected website = signal<string>('');
  protected contactPerson = signal<string>('');
  protected phone = signal<string>('');

  // Status & Feedback details
  protected tpoFeedback = signal<string>('');
  protected tpoSuggestions = signal<string>('');

  // UI state
  protected isLoading = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  // ── Validation Getters ───────────────────────────────────────────────────────
  protected get companyNameValid(): boolean {
    return this.companyName().trim().length > 1;
  }

  protected get emailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.officialEmail().trim());
  }

  protected get websiteValid(): boolean {
    const w = this.website().trim();
    if (!w) return false;
    return /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i.test(w);
  }

  protected get contactPersonValid(): boolean {
    return this.contactPerson().trim().length > 1;
  }

  protected get phoneValid(): boolean {
    const p = this.phone().trim();
    return p.startsWith('+') && p.length >= 12 && /^\+[0-9\s-]{11,18}$/.test(p);
  }

  protected get isFormValid(): boolean {
    return (
      this.companyNameValid &&
      this.emailValid &&
      this.websiteValid &&
      this.contactPersonValid &&
      this.phoneValid
    );
  }

  protected get validationItems(): { label: string; met: boolean }[] {
    return [
      { label: 'Company name entered', met: this.companyNameValid },
      { label: 'Valid official email', met: this.emailValid },
      { label: 'Valid official website URL', met: this.websiteValid },
      { label: 'Contact person name entered', met: this.contactPersonValid },
      { label: 'Phone number with + country code (min 12 chars e.g. +919876543210)', met: this.phoneValid },
    ];
  }

  ngOnInit(): void {
    this.fetchProfileDetails();
  }

  private fetchProfileDetails(): void {
    this.isLoading.set(true);
    this.recruiterService.getProfile().subscribe({
      next: (res) => {
        if (res && res.data) {
          const profile = res.data;
          this.companyName.set(profile.companyName || '');
          this.officialEmail.set(profile.officialEmail || '');
          this.website.set(profile.website || '');
          this.contactPerson.set(profile.user?.name || '');
          this.phone.set((profile as any).phone || (profile as any).user?.phone || '');
          
          // Get suggestions/feedback
          const holdFeedback = (profile as any).holdFeedback;
          if (holdFeedback) {
            this.tpoFeedback.set(holdFeedback.message || '');
            this.tpoSuggestions.set(holdFeedback.suggestions || '');
          } else if (profile.tpoSuggestions && profile.tpoSuggestions.length > 0) {
            this.tpoFeedback.set(profile.tpoSuggestions[profile.tpoSuggestions.length - 1].suggestion);
          }
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch profile details:', err);
        this.errorMessage.set('Unauthorized session or failed to fetch profile. Please log in again.');
        this.isLoading.set(false);
      }
    });
  }

  protected submitEdit(): void {
    if (!this.isFormValid) {
      this.errorMessage.set('Please satisfy all validation criteria in the checklist below before submitting.');
      setTimeout(() => this.errorMessage.set(null), 10000);
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const updateData = {
      companyName: this.companyName().trim(),
      officialEmail: this.officialEmail().trim(),
      website: this.website().trim(),
      contactPerson: this.contactPerson().trim(),
      phone: this.phone().trim()
    };

    // 1. Update company profile details
    this.recruiterService.updateProfileJson(updateData).subscribe({
      next: () => {
        // 2. Request Re-approval (status pending)
        this.recruiterService.requestReapproval().subscribe({
          next: () => {
            this.isSubmitting.set(false);
            // Clear token to log out and force fresh login
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            
            // Navigate back to login with success message
            this.router.navigate(['/login'], {
              queryParams: { reapprovalSuccess: 'true' }
            });
          },
          error: (err) => {
            this.isSubmitting.set(false);
            this.errorMessage.set(err?.error?.message || 'Profile updated, but failed to submit re-approval request.');
          }
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to update company profile details.');
      }
    });
  }
}
