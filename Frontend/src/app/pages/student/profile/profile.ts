import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService, StudentProfile } from '../../../services/student.service';
import { environment } from '../../../../environments/environment';
import { IndiaLocationService } from '../../../services/india-location.service';
import { FormControl } from '@angular/forms';
import { meaningfulTextValidator } from '../../../validators/meaningful-text.validator';
import { ToastService } from '../../../services/toast.service';

// Parses a saved address string like "House/Flat Name, District, State - PINCODE"
// back into sub-fields for editing.
function parseAddressString(address: string): { houseName: string; state: string; district: string; pinCode: string } {
  if (!address || !address.trim()) {
    return { houseName: '', state: '', district: '', pinCode: '' };
  }
  // Try to match the canonical save format: "houseName, district, state - pinCode"
  const pinMatch = address.match(/^(.*?)\s*-\s*(\d{6})$/);
  let body = address;
  let pinCode = '';
  if (pinMatch) {
    body = pinMatch[1].trim();
    pinCode = pinMatch[2].trim();
  }
  const parts = body.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      houseName: parts.slice(0, parts.length - 2).join(', '),
      district: parts[parts.length - 2],
      state: parts[parts.length - 1],
      pinCode,
    };
  } else if (parts.length === 2) {
    return { houseName: parts[0], district: '', state: parts[1], pinCode };
  } else {
    return { houseName: body, state: '', district: '', pinCode };
  }
}

function buildAddressString(houseName: string, district: string, state: string, pinCode: string): string {
  const parts: string[] = [];
  if (houseName.trim()) parts.push(houseName.trim());
  if (district.trim()) parts.push(district.trim());
  if (state.trim()) parts.push(state.trim());
  let combined = parts.join(', ');
  if (pinCode.trim()) combined += ` - ${pinCode.trim()}`;
  return combined;
}

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class StudentProfileComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  private readonly toastService = inject(ToastService);
  private readonly locationService = inject(IndiaLocationService);

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

  // ----- Structured Address Sub-fields -----
  protected addrHouseName = signal<string>('');
  protected addrState = signal<string>('');
  protected addrDistrict = signal<string>('');
  protected addrPinCode = signal<string>('');

  // Location dropdown data
  protected availableStates = signal<string[]>([]);
  protected availableDistricts = signal<string[]>([]);
  protected isLoadingStates = signal<boolean>(false);
  protected isLoadingDistricts = signal<boolean>(false);

  // PIN Code API Verification Signals
  protected isCheckingPinCode = signal<boolean>(false);
  protected pinCodeApiError = signal<string | null>(null);
  protected pinCodeVerifiedInfo = signal<{ state?: string; district?: string } | null>(null);

  // Address touch signals
  protected houseNameTouched = signal<boolean>(false);
  protected stateTouched = signal<boolean>(false);
  protected districtTouched = signal<boolean>(false);
  protected pinCodeTouched = signal<boolean>(false);

  // Field Touched Signals for Live Validation
  protected isSaveTriggered = signal<boolean>(false);
  protected isSaveSuccess = signal<boolean>(false);

  protected contactNumberTouched = signal<boolean>(false);
  protected cgpaTouched = signal<boolean>(false);
  protected branchTouched = signal<boolean>(false);
  protected passoutYearTouched = signal<boolean>(false);
  protected backlogsTouched = signal<boolean>(false);

  // Live password attempt check
  protected isPasswordAttempted = computed(() => {
    return (
      this.currentPassword().length > 0 ||
      this.newPassword().length > 0 ||
      this.confirmPassword().length > 0
    );
  });

  // ----- Live Address Validation -----
  protected houseNameError = computed(() => {
    const v = this.addrHouseName().trim();
    if (!v) return null; // optional field, but validate if filled
    if (v.length < 3) return 'House / Flat name must be at least 3 characters.';
    return null;
  });

  protected stateError = computed(() => {
    if (!this.addrState().trim()) return null; // optional
    return null;
  });

  protected districtError = computed(() => {
    if (this.addrState().trim() && !this.addrDistrict().trim()) {
      if (this.districtTouched() || this.isSaveTriggered()) return 'Please select a district.';
    }
    return null;
  });

  protected pinCodeError = computed(() => {
    const v = this.addrPinCode().trim();
    if (!v) return null; // optional
    if (v.length !== 6) return 'PIN Code must be exactly 6 digits.';
    if (!/^[1-9][0-9]{5}$/.test(v)) return 'PIN Code cannot start with 0.';
    if (this.pinCodeApiError()) return this.pinCodeApiError();
    return null;
  });

  // Computed combined address string (sent to backend)
  protected get combinedAddress(): string {
    return buildAddressString(
      this.addrHouseName(),
      this.addrDistrict(),
      this.addrState(),
      this.addrPinCode()
    );
  }

  // Live validation error signals
  protected contactNumberError = computed(() => {
    const p = this.profile();
    if (!p) return null;
    const phone = p.contactNumber ? p.contactNumber.trim() : '';
    if (!phone) return null;
    if (!/^[0-9+\s()-]{7,20}$/.test(phone)) {
      return 'Please enter a valid phone number (e.g. +91 9876543210)';
    }
    return null;
  });

  protected cgpaError = computed(() => {
    const p = this.profile();
    if (!p) return 'CGPA is required';
    const val = p.cgpa;
    if (val === null || val === undefined || isNaN(Number(val)) || String(val).trim() === '') {
      return 'CGPA is required';
    }
    const num = Number(val);
    if (num < 0 || num > 10) {
      return 'CGPA must be between 0 and 10';
    }
    return null;
  });

  protected branchError = computed(() => {
    const p = this.profile();
    if (!p) return 'Branch is required';
    const b = p.branch;
    if (!b || !b.trim()) {
      return 'Please select a branch';
    }
    return null;
  });

  protected passoutYearError = computed(() => {
    const p = this.profile();
    if (!p) return 'Passout year is required';
    const y = p.passoutYear;
    if (!y || isNaN(Number(y))) return 'Passout year is required';
    const num = Number(y);
    if (num < 2000 || num > 2100) return 'Passout year must be a valid 4-digit year (2000-2100)';
    return null;
  });

  protected backlogsError = computed(() => {
    const p = this.profile();
    if (!p) return 'Active backlogs is required';
    const bg = p.activeBacklogs;
    if (bg === null || bg === undefined || isNaN(Number(bg)) || String(bg).trim() === '') {
      return 'Active backlogs field is required';
    }
    const num = Number(bg);
    if (num < 0) return 'Active backlogs cannot be negative';
    if (!Number.isInteger(num)) return 'Active backlogs must be a whole number';
    return null;
  });

  protected currentPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return null;
    if (!this.currentPassword().trim()) return 'Current password is required to change password';
    return null;
  });

  protected newPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return null;
    const pw = this.newPassword().trim();
    if (!pw) return 'New password is required';
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
      return 'Password does not meet complexity requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 digit)';
    }
    return null;
  });

  protected confirmPasswordError = computed(() => {
    if (!this.isPasswordAttempted()) return null;
    const conf = this.confirmPassword().trim();
    const newPw = this.newPassword().trim();
    if (!conf) return 'Repeat password is required';
    if (conf !== newPw) return 'Passwords do not match';
    if (this.newPasswordError()) return 'Fix errors in new password first';
    return null;
  });

  protected isFormInvalid = computed(() => {
    if (this.cgpaError()) return true;
    if (this.branchError()) return true;
    if (this.passoutYearError()) return true;
    if (this.backlogsError()) return true;
    if (this.contactNumberError()) return true;
    if (this.houseNameError()) return true;
    if (this.pinCodeError()) return true;
    if (this.districtError()) return true;
    if (this.isCheckingPinCode()) return true;
    if (this.isPasswordAttempted()) {
      if (this.currentPasswordError() || this.newPasswordError() || this.confirmPasswordError()) {
        return true;
      }
    }
    return false;
  });

  protected onPinCodeChange(val: string): void {
    this.addrPinCode.set(val);
    this.pinCodeTouched.set(true);
    this.pinCodeApiError.set(null);
    this.pinCodeVerifiedInfo.set(null);

    const clean = (val || '').trim();
    if (clean.length === 6 && /^[1-9][0-9]{5}$/.test(clean)) {
      this.isCheckingPinCode.set(true);
      this.locationService.verifyPinCode(clean).subscribe({
        next: (res) => {
          this.isCheckingPinCode.set(false);
          if (res.isValid) {
            this.pinCodeApiError.set(null);
            this.pinCodeVerifiedInfo.set({ state: res.state, district: res.district });
          } else {
            this.pinCodeApiError.set(res.message || 'Invalid Indian PIN Code.');
          }
        },
        error: () => {
          this.isCheckingPinCode.set(false);
        }
      });
    }
  }

  protected globalSaveError = signal<string | null>(null);
  protected globalSaveSuccess = signal<string | null>(null);

  protected availableBranches = signal<string[]>(['CSE', 'ECE', 'IT', 'ME', 'CE', 'BCA', 'MCA', 'INMCA', 'EEE', 'AD']);
  protected availablePassoutYears = signal<number[]>([2024, 2025, 2026, 2027, 2028]);

  protected getMeaningfulError(val: string): string | null {
    if (!val || !val.trim()) return null;
    const control = new FormControl(val);
    const errors = meaningfulTextValidator(control);
    if (!errors) return null;
    if (errors['tooFewLetters']) return 'Please enter at least 2 alphabetic characters.';
    if (errors['noVowel']) return "Please enter a meaningful value.";
    if (errors['repeatingChars']) return "Please avoid repeating characters (e.g., 'aaaa').";
    return null;
  }

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
    this.loadCollegeConfig();
    this.loadProfile();
    this.loadStates();
  }

  // ----- Location Loading -----
  private loadStates(): void {
    this.isLoadingStates.set(true);
    this.locationService.getStates().subscribe({
      next: (states) => {
        this.availableStates.set(states);
        this.isLoadingStates.set(false);
      },
      error: () => {
        this.isLoadingStates.set(false);
      }
    });
  }

  protected onStateChange(stateName: string): void {
    this.addrState.set(stateName);
    this.addrDistrict.set(''); // reset district when state changes
    this.availableDistricts.set([]);
    this.stateTouched.set(true);
    if (stateName.trim()) {
      this.isLoadingDistricts.set(true);
      this.locationService.getDistricts(stateName).subscribe({
        next: (districts) => {
          this.availableDistricts.set(districts);
          this.isLoadingDistricts.set(false);
        },
        error: () => {
          this.isLoadingDistricts.set(false);
        }
      });
    }
  }

  protected onFieldChange(field: string, value: any): void {
    const p = this.profile();
    if (!p) return;

    if (field === 'contactNumber') {
      this.contactNumberTouched.set(true);
      p.contactNumber = value;
    } else if (field === 'cgpa') {
      this.cgpaTouched.set(true);
      p.cgpa = value;
    } else if (field === 'branch') {
      this.branchTouched.set(true);
      p.branch = value;
    } else if (field === 'passoutYear') {
      this.passoutYearTouched.set(true);
      p.passoutYear = value;
    } else if (field === 'activeBacklogs') {
      this.backlogsTouched.set(true);
      p.activeBacklogs = value;
    }
    this.profile.set({ ...p });
  }

  private loadCollegeConfig(): void {
    this.studentService.getCollegeConfig().subscribe({
      next: (res) => {
        if (res && res.data) {
          if (Array.isArray(res.data.branches) && res.data.branches.length > 0) {
            this.availableBranches.set(res.data.branches);
          }
          if (Array.isArray(res.data.passoutYears) && res.data.passoutYears.length > 0) {
            this.availablePassoutYears.set(res.data.passoutYears);
          }
        }
      },
      error: (err) => console.error('Failed to load college configuration:', err)
    });
  }

  protected loadProfile(): void {
    this.isLoading.set(true);
    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          const prof = res.profile;
          if (!prof.contactNumber && prof.userId?.phone) {
            prof.contactNumber = prof.userId.phone;
          }
          if (prof.address === undefined || prof.address === null) {
            prof.address = '';
          }
          this.profile.set(prof);

          // Parse existing address string into sub-fields
          const parsed = parseAddressString(prof.address || '');
          this.addrHouseName.set(parsed.houseName);
          this.addrState.set(parsed.state);
          this.addrDistrict.set(parsed.district);
          if (parsed.pinCode) {
            this.onPinCodeChange(parsed.pinCode);
          } else {
            this.addrPinCode.set('');
          }

          // If we have a state, pre-load its districts
          if (parsed.state.trim()) {
            this.locationService.getDistricts(parsed.state).subscribe({
              next: (districts) => {
                this.availableDistricts.set(districts);
              }
            });
          }
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
        this.toastService.error(
          'Photo too large',
          'Profile photo must be under 2 MB'
        );
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
        this.toastService.error(
          'Invalid file type',
          'Only PDF files are accepted for resume uploads'
        );
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

  protected getResumeUrl(): string {
    const path = this.profile()?.resumePath;
    if (!path) return '#';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${environment.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  protected saveAllChanges(): void {
    this.isSaveTriggered.set(true);
    this.contactNumberTouched.set(true);
    this.cgpaTouched.set(true);
    this.branchTouched.set(true);
    this.passoutYearTouched.set(true);
    this.backlogsTouched.set(true);
    this.houseNameTouched.set(true);
    this.stateTouched.set(true);
    this.districtTouched.set(true);
    this.pinCodeTouched.set(true);

    this.isSaveSuccess.set(false);
    this.globalSaveError.set(null);
    this.globalSaveSuccess.set(null);

    const p = this.profile();
    if (!p) return;

    if (this.isFormInvalid()) {
      this.globalSaveError.set('Validation failed. Please correct the fields marked in red.');
      return;
    }

    this.isLoading.set(true);

    // Build combined address string for backend
    const addressValue = this.combinedAddress;

    const formData = new FormData();
    formData.append('rollNumber', p.rollNumber);
    formData.append('contactNumber', p.contactNumber ? p.contactNumber.trim() : '');
    formData.append('address', addressValue);
    formData.append('cgpa', String(p.cgpa));
    formData.append('branch', p.branch);
    formData.append('passoutYear', String(p.passoutYear));
    formData.append('activeBacklogs', String(p.activeBacklogs));

    if (this.selectedPhotoFile) {
      formData.append('profilePic', this.selectedPhotoFile);
    }

    if (this.isPasswordAttempted()) {
      formData.append('password', this.newPassword().trim());
    }

    this.studentService.updateProfile(formData).subscribe({
      next: (res) => {
        const prof = res.profile;
        if (!prof.contactNumber && prof.userId?.phone) {
          prof.contactNumber = prof.userId.phone;
        }
        if (prof.address === undefined || prof.address === null) {
          prof.address = '';
        }
        this.profile.set(prof);
        // Re-parse address for consistency
        const parsed = parseAddressString(prof.address || '');
        this.addrHouseName.set(parsed.houseName);
        this.addrState.set(parsed.state);
        this.addrDistrict.set(parsed.district);
        this.addrPinCode.set(parsed.pinCode);

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
    this.contactNumberTouched.set(false);
    this.cgpaTouched.set(false);
    this.branchTouched.set(false);
    this.passoutYearTouched.set(false);
    this.backlogsTouched.set(false);
    this.houseNameTouched.set(false);
    this.stateTouched.set(false);
    this.districtTouched.set(false);
    this.pinCodeTouched.set(false);
    this.isSaveSuccess.set(false);
    this.globalSaveError.set(null);
    this.globalSaveSuccess.set(null);
    this.loadProfile();
  }
}
