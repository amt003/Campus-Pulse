import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, StudentProfile } from '../../../services/student.service';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class StudentProfileComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  protected profile = signal<StudentProfile | null>(null);
  protected isLoading = signal<boolean>(true);

  // Photo state
  protected selectedPhotoFile: File | null = null;
  protected photoPreviewUrl = signal<string | null>(null);

  // Security / Password state
  protected currentPassword = signal<string>('');
  protected newPassword = signal<string>('');
  protected confirmPassword = signal<string>('');

  protected showCurrentPassword = signal<boolean>(false);
  protected showNewPassword = signal<boolean>(false);
  protected showConfirmPassword = signal<boolean>(false);

  // Validation States
  protected isSaveTriggered = signal<boolean>(false);
  protected isSaveSuccess = signal<boolean>(false);
  protected cgpaError = signal<boolean>(false);
  protected branchError = signal<boolean>(false);
  protected passoutYearError = signal<boolean>(false);
  protected backlogsError = signal<boolean>(false);
  protected currentPasswordError = signal<boolean>(false);
  protected newPasswordError = signal<boolean>(false);
  protected confirmPasswordError = signal<boolean>(false);
  protected globalSaveError = signal<string | null>(null);
  protected globalSaveSuccess = signal<string | null>(null);

  // Resume upload indicators
  protected isUploadingResume = signal<boolean>(false);
  protected uploadSuccessMsg = signal<string | null>(null);
  protected uploadErrorMsg = signal<string | null>(null);

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

  ngOnInit(): void {
    this.loadProfile();
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          this.profile.set(res.profile);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected onPhotoSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('File size exceeds the 2MB limit.');
        return;
      }
      this.selectedPhotoFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreviewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  protected onResumeFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF document.');
        return;
      }
      this.isUploadingResume.set(true);
      this.uploadSuccessMsg.set(null);
      this.uploadErrorMsg.set(null);

      const formData = new FormData();
      formData.append('resume', file);

      this.studentService.uploadResume(formData).subscribe({
        next: (res) => {
          if (this.profile()) {
            this.profile.set({
              ...this.profile()!,
              resumePath: res.resumePath
            });
          }
          this.uploadSuccessMsg.set('Resume uploaded successfully.');
          this.isUploadingResume.set(false);
          setTimeout(() => this.uploadSuccessMsg.set(null), 3000);
        },
        error: (err) => {
          this.uploadErrorMsg.set(err.error?.message || 'Failed to upload resume.');
          this.isUploadingResume.set(false);
          setTimeout(() => this.uploadErrorMsg.set(null), 3000);
        }
      });
    }
  }

  protected getResumeFileName(): string {
    const path = this.profile()?.resumePath;
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  protected saveAllChanges(): void {
    this.isSaveTriggered.set(true);
    this.isSaveSuccess.set(false);
    this.globalSaveError.set(null);
    this.globalSaveSuccess.set(null);

    this.cgpaError.set(false);
    this.branchError.set(false);
    this.passoutYearError.set(false);
    this.backlogsError.set(false);
    this.currentPasswordError.set(false);
    this.newPasswordError.set(false);
    this.confirmPasswordError.set(false);

    const p = this.profile();
    if (!p) return;

    let hasError = false;

    if (p.cgpa === null || p.cgpa === undefined || p.cgpa < 0 || p.cgpa > 10) {
      this.cgpaError.set(true);
      hasError = true;
    }

    if (!p.branch || !['CSE', 'ECE', 'IT', 'ME', 'Civil', 'BCA', 'MCA', 'INMCA', 'EEE', 'CE', 'AD'].includes(p.branch)) {
      this.branchError.set(true);
      hasError = true;
    }

    if (!p.passoutYear || p.passoutYear < 2020 || p.passoutYear > 2030) {
      this.passoutYearError.set(true);
      hasError = true;
    }

    if (p.activeBacklogs === null || p.activeBacklogs === undefined || p.activeBacklogs < 0) {
      this.backlogsError.set(true);
      hasError = true;
    }

    const curPw = this.currentPassword().trim();
    const newPw = this.newPassword().trim();
    const confPw = this.confirmPassword().trim();

    const isPasswordAttempted = curPw.length > 0 || newPw.length > 0 || confPw.length > 0;

    if (isPasswordAttempted) {
      if (!curPw) {
        this.currentPasswordError.set(true);
        hasError = true;
      }
      if (newPw.length < 8 || !/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) || !/[0-9]/.test(newPw)) {
        this.newPasswordError.set(true);
        hasError = true;
      }
      if (newPw !== confPw) {
        this.confirmPasswordError.set(true);
        hasError = true;
      }
    }

    if (hasError) {
      this.globalSaveError.set('Validation failed. Please correct the fields marked in red.');
      return;
    }

    this.isLoading.set(true);

    const formData = new FormData();
    formData.append('rollNumber', p.rollNumber);
    formData.append('cgpa', String(p.cgpa));
    formData.append('branch', p.branch);
    formData.append('passoutYear', String(p.passoutYear));
    formData.append('activeBacklogs', String(p.activeBacklogs));

    if (this.selectedPhotoFile) {
      formData.append('profilePic', this.selectedPhotoFile);
    }

    if (isPasswordAttempted) {
      formData.append('password', newPw);
    }

    this.studentService.updateProfile(formData).subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.selectedPhotoFile = null;
        this.photoPreviewUrl.set(null);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.isSaveSuccess.set(true);
        this.globalSaveSuccess.set('Changes saved successfully!');
        this.isLoading.set(false);
        setTimeout(() => {
          this.globalSaveSuccess.set(null);
          this.isSaveTriggered.set(false);
        }, 4000);
      },
      error: (err) => {
        this.globalSaveError.set(err.error?.message || 'Failed to save changes. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  protected cancelProfileChanges(): void {
    this.selectedPhotoFile = null;
    this.photoPreviewUrl.set(null);
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.isSaveTriggered.set(false);
    this.isSaveSuccess.set(false);
    this.globalSaveError.set(null);
    this.globalSaveSuccess.set(null);
    this.loadProfile();
  }
}
