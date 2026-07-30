import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StudentService, StudentProfile, Drive, Application } from '../../../services/student.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class StudentDashboardComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  private readonly router = inject(Router);

  // ── States ──────────────────────────────────────────────────────────────
  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  protected profile = signal<StudentProfile | null>(null);
  protected allDrives = signal<Drive[]>([]);
  protected applications = signal<Application[]>([]);
  protected activeTab = signal<'drives' | 'applications' | 'profile'>('drives');
  protected filterEligibleOnly = signal<boolean>(false);

  // ── Create Profile Form State (for non-imported manually registered students) ─
  protected newRollNumber = '';
  protected newCgpa = 8.0;
  protected newBranch = 'CSE';
  protected newPassoutYear = 2024;
  protected newBacklogs = 0;
  protected formErrorMessage = signal<string | null>(null);

  // ── Resume Upload State ──────────────────────────────────────────────────
  protected isUploadingResume = signal<boolean>(false);
  protected uploadSuccessMsg = signal<string | null>(null);
  protected uploadErrorMsg = signal<string | null>(null);

  // ── Stats for Dashboard (computed) ──────────────────────────────────────
  protected totalApplied = computed(() => this.applications().length);
  protected totalOffers = computed(() => this.applications().filter(a => a.offer?.status === 'Accepted' || a.status === 'Placed').length);
  protected pendingApprovals = computed(() => this.applications().filter(a => a.status === 'Applied').length);
  protected maxPackageApplied = computed(() => {
    const activeApps = this.applications();
    if (!activeApps.length) return 0;
    const packages = activeApps.map(a => a.driveId?.ctc || 0);
    return Math.max(...packages);
  });

  // ── Eligible Branches List ────────────────────────────────────────────────
  protected branchesList = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'Biotech'];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  protected loadDashboardData(): void {
    this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          this.profile.set(res.profile);
          this.fetchDrivesAndApplications();
        } else {
          this.profile.set(null);
          this.isLoading.set(false);
          this.isRefreshing.set(false);
        }
      },
      error: (err) => {
        console.error('Failed to load student profile:', err);
        this.profile.set(null);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      }
    });
  }

  private fetchDrivesAndApplications(): void {
    Promise.all([
      this.studentService.getEligibleDrives().toPromise(),
      this.studentService.getApplications().toPromise()
    ])
      .then(([drivesRes, appsRes]) => {
        this.allDrives.set(drivesRes?.drives || []);
        this.applications.set(appsRes?.applications || []);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      })
      .catch((err) => {
        console.error('Failed to load student dashboard items:', err);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      });
  }

  protected refreshData(): void {
    this.fetchDrivesAndApplications();
  }

  // ── Tab Switching ────────────────────────────────────────────────────────
  protected switchTab(tab: 'drives' | 'applications' | 'profile'): void {
    this.activeTab.set(tab);
  }

  // ── Profile Creation ─────────────────────────────────────────────────────
  protected submitCreateProfile(): void {
    if (!this.newRollNumber.trim() || !this.newBranch.trim()) {
      this.formErrorMessage.set('Please fill out all fields correctly.');
      return;
    }

    const payload: Partial<StudentProfile> = {
      rollNumber: this.newRollNumber.trim().toUpperCase(),
      cgpa: Number(this.newCgpa),
      branch: this.newBranch,
      passoutYear: Number(this.newPassoutYear),
      activeBacklogs: Number(this.newBacklogs),
      isProfileComplete: true
    };

    this.studentService.updateProfile(payload).subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.loadDashboardData();
      },
      error: (err) => {
        this.formErrorMessage.set(err.error?.message || 'Failed to initialize profile. Please try again.');
      }
    });
  }

  // ── Profile Details Update ────────────────────────────────────────────────
  protected submitUpdateProfile(): void {
    const prof = this.profile();
    if (!prof) return;

    this.studentService.updateProfile({
      rollNumber: prof.rollNumber,
      cgpa: Number(prof.cgpa),
      branch: prof.branch,
      passoutYear: Number(prof.passoutYear),
      activeBacklogs: Number(prof.activeBacklogs)
    }).subscribe({
      next: (res) => {
        this.profile.set(res.profile);
        this.uploadSuccessMsg.set('Profile details updated successfully.');
        setTimeout(() => this.uploadSuccessMsg.set(null), 3000);
      },
      error: (err) => {
        this.uploadErrorMsg.set(err.error?.message || 'Failed to update profile.');
        setTimeout(() => this.uploadErrorMsg.set(null), 3000);
      }
    });
  }

  // ── Apply to Drive ───────────────────────────────────────────────────────
  protected applyToDrive(driveId: string): void {
    const profileData = this.profile();
    if (!profileData || !profileData.resumePath) {
      alert('Please upload your resume in the "Profile & Resume" section before applying.');
      this.switchTab('profile');
      return;
    }

    this.studentService.applyToDrive(driveId).subscribe({
      next: () => {
        alert('Applied to drive successfully!');
        this.fetchDrivesAndApplications();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to submit application. Please try again.');
      }
    });
  }

  // ── Resume Upload ────────────────────────────────────────────────────────
  protected onResumeFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      this.uploadErrorMsg.set('Please upload a PDF file only.');
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    this.isUploadingResume.set(true);
    this.uploadSuccessMsg.set(null);
    this.uploadErrorMsg.set(null);

    this.studentService.uploadResume(formData).subscribe({
      next: (res) => {
        this.isUploadingResume.set(false);
        this.uploadSuccessMsg.set('Resume uploaded successfully.');
        if (this.profile()) {
          this.profile.set({
            ...this.profile()!,
            resumePath: res.resumePath,
            isProfileComplete: true
          });
        }
      },
      error: (err) => {
        this.isUploadingResume.set(false);
        this.uploadErrorMsg.set(err.error?.message || 'Failed to upload resume. Please try again.');
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  protected isApplied(driveId: string): boolean {
    return this.applications().some(a => a.driveId?._id === driveId);
  }

  protected getApplicationStatus(driveId: string): string {
    const app = this.applications().find(a => a.driveId?._id === driveId);
    return app ? app.status : 'Not Applied';
  }

  protected isEligible(drive: Drive): boolean {
    const p = this.profile();
    if (!p) return false;

    // Check CGPA
    if (p.cgpa < drive.minCGPA) return false;
    // Check Backlogs
    if (p.activeBacklogs > drive.maxBacklogs) return false;
    // Check Branch
    if (drive.eligibleBranches && drive.eligibleBranches.length > 0 && !drive.eligibleBranches.includes(p.branch)) return false;

    return true;
  }

  protected getEligibilityReason(drive: Drive): string {
    const p = this.profile();
    if (!p) return 'Profile incomplete';

    const reasons: string[] = [];
    if (p.cgpa < drive.minCGPA) {
      reasons.push(`Requires Min CGPA ${drive.minCGPA} (You have ${p.cgpa})`);
    }
    if (p.activeBacklogs > drive.maxBacklogs) {
      reasons.push(`Allows Max ${drive.maxBacklogs} Backlogs (You have ${p.activeBacklogs})`);
    }
    if (drive.eligibleBranches && drive.eligibleBranches.length > 0 && !drive.eligibleBranches.includes(p.branch)) {
      reasons.push(`Only for branches: ${drive.eligibleBranches.join(', ')} (You are ${p.branch})`);
    }

    return reasons.join('; ');
  }

  protected get filteredDrives(): Drive[] {
    const drives = this.allDrives();
    if (this.filterEligibleOnly()) {
      return drives.filter(d => this.isEligible(d));
    }
    return drives;
  }

  protected getCTCInLpa(ctc: number): string {
    return (ctc / 100000).toFixed(1) + ' LPA';
  }

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
