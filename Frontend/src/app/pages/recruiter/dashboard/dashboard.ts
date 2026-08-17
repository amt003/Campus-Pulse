import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { RecruiterService, RecruiterProfile } from '../../../services/recruiter.service';
import { meaningfulTextValidator } from '../../../validators/meaningful-text.validator';
import { ManageResourcesModalComponent } from '../../../components/modals/manage-resources-modal/manage-resources-modal.component';

export interface DriveItem {
  _id: string;
  title: string;
  description?: string;
  status: 'Draft' | 'Pending' | 'Open' | 'Closed' | 'Rejected' | 'OnHold';
  tpoFeedback?: string;
  resubmittedCount?: number;
  applicationsCount: number;
  applicationDeadline: string;
  ctc: number;
  minCGPA: number;
  maxBacklogs?: number;
  eligibleBranches: string[];
  hasAptitudeTest?: boolean;
  hasGD?: boolean;
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ManageResourcesModalComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class RecruiterDashboardComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly router = inject(Router);
  protected Math = Math;

  protected isLoading = signal<boolean>(true);
  protected profile = signal<RecruiterProfile | null>(null);
  protected drives = signal<DriveItem[]>([]);
  protected isRefreshing = signal<boolean>(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected isSubmitting = signal<boolean>(false);

  // Edit Mode state
  protected editingDriveId = signal<string | null>(null);

  // Kebab menu & Resources Modal
  protected activeDropdown = signal<string | null>(null);
  protected selectedDriveForResources = signal<{ id: string; title: string } | null>(null);

  // Stats for Approved State
  protected activeDrivesCount = signal<number>(0);
  protected totalApplicationsCount = signal<number>(0);
  protected shortlistedCount = signal<number>(0);
  protected offerAcceptanceRate = signal<number>(0);

  protected upcomingInterviews = signal<any[]>([]);

  protected pipelineData = signal<{ applied: number; screening: number; interview: number; offer: number }>({
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0
  });

  protected pipelineHeights = computed(() => {
    const data = this.pipelineData();
    const maxVal = Math.max(data.applied, data.screening, data.interview, data.offer);
    if (maxVal === 0) {
      return {
        appliedHeight: 8,
        screeningHeight: 8,
        interviewHeight: 8,
        offerHeight: 8,
      };
    }
    return {
      appliedHeight: data.applied > 0 ? Math.max(12, Math.round((data.applied / maxVal) * 85)) : 8,
      screeningHeight: data.screening > 0 ? Math.max(12, Math.round((data.screening / maxVal) * 85)) : 8,
      interviewHeight: data.interview > 0 ? Math.max(12, Math.round((data.interview / maxVal) * 85)) : 8,
      offerHeight: data.offer > 0 ? Math.max(12, Math.round((data.offer / maxVal) * 85)) : 8,
    };
  });

  // Create/Edit Drive Modal / Form state
  protected isCreateModalOpen = signal<boolean>(false);
  
  // Applicant List Modal state
  protected isApplicationsModalOpen = signal<boolean>(false);
  protected selectedDriveTitle = signal<string>('');
  protected applications = signal<any[]>([]);
  protected selectedApplication = signal<any | null>(null);
  protected newDriveTitle = signal<string>('');
  protected newDriveCTC = signal<number>(1200000);
  protected newDriveMinCGPA = signal<number>(7.0);
  protected newDriveMaxBacklogs = signal<number>(0);
  protected newDriveDeadline = signal<string>('');
  protected newDriveDesc = signal<string>('');
  protected newDriveHasAptitude = signal<boolean>(false);
  protected newDriveHasGD = signal<boolean>(false);
  
  protected availableBranches = ['BCA', 'MCA', 'INMCA', 'ECE', 'CSE', 'IT', 'EEE', 'ME', 'CE', 'AD'];
  protected selectedBranches = signal<string[]>(['CSE', 'IT', 'ECE']);
  protected todayDate = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    this.fetchProfile();
  }

  protected fetchProfile(): void {
    this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.recruiterService.getProfile().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.profile.set(res.data);
          if (res.data.isApproved) {
            this.fetchDrives();
          }
        }
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch recruiter profile:', err);
        // Fallback profile if offline/testing
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        let compName = 'Company';
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            compName = u.recruiter?.companyName || u.name || 'Company';
          } catch (e) {}
        }

        this.profile.set({
          recruiterId: 'rec_123',
          companyName: compName,
          officialEmail: 'hr@company.com',
          isApproved: false,
          trustScore: 85,
          user: { name: 'HR Manager', email: 'hr@company.com' },
        });

        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  protected fetchDrives(): void {
    this.recruiterService.getDrives().subscribe({
      next: (res) => {
        const driveList: DriveItem[] = res.drives || [];
        this.drives.set(driveList);
        this.activeDrivesCount.set(driveList.filter((d) => d.status === 'Open').length);
        this.totalApplicationsCount.set(driveList.reduce((acc, d) => acc + (d.applicationsCount || 0), 0));
        this.fetchAnalytics();
      },
      error: (err) => {
        console.error('Failed to fetch drives:', err);
        this.fetchAnalytics();
      },
    });
  }

  protected fetchAnalytics(): void {
    this.recruiterService.getAnalytics().subscribe({
      next: (res) => {
        if (res && res.analytics) {
          if (res.analytics.pipeline) {
            this.pipelineData.set(res.analytics.pipeline);
            this.shortlistedCount.set(res.analytics.pipeline.interview || 0);
          }
          if (res.analytics.offerAcceptanceRate !== undefined) {
            this.offerAcceptanceRate.set(res.analytics.offerAcceptanceRate);
          }
          this.upcomingInterviews.set(res.analytics.upcomingInterviews || []);
        }
      },
      error: (err) => {
        console.error('Failed to fetch recruiter analytics:', err);
      }
    });
  }

  protected navigateToSchedules(): void {
    const drivesList = this.drives();
    if (drivesList.length > 0) {
      this.router.navigate(['/recruiter/applications', drivesList[0]._id]);
    } else {
      this.router.navigate(['/recruiter/drives']);
    }
  }

  protected refreshStatus(): void {
    this.fetchProfile();
  }

  protected toggleBranch(branch: string): void {
    const current = this.selectedBranches();
    if (current.includes(branch)) {
      this.selectedBranches.set(current.filter((b) => b !== branch));
    } else {
      this.selectedBranches.set([...current, branch]);
    }
  }

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  // Create / Edit Drive Handlers
  protected openCreateModal(): void {
    this.editingDriveId.set(null);
    this.resetForm();
    this.errorMessage.set(null);
    this.isCreateModalOpen.set(true);
  }

  protected openEditModal(drive: DriveItem): void {
    this.editingDriveId.set(drive._id);
    this.newDriveTitle.set(drive.title || '');
    this.newDriveDesc.set(drive.description || '');
    this.newDriveCTC.set(drive.ctc || 1200000);
    this.newDriveMinCGPA.set(drive.minCGPA || 7.0);
    this.newDriveMaxBacklogs.set(drive.maxBacklogs || 0);
    this.newDriveDeadline.set(drive.applicationDeadline ? new Date(drive.applicationDeadline).toISOString().split('T')[0] : '');
    this.selectedBranches.set(drive.eligibleBranches || ['CSE', 'IT', 'ECE']);
    this.newDriveHasAptitude.set(!!drive.hasAptitudeTest);
    this.newDriveHasGD.set(!!drive.hasGD);
    this.errorMessage.set(null);
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.editingDriveId.set(null);
  }

  private resetForm(): void {
    this.newDriveTitle.set('');
    this.newDriveDesc.set('');
    this.newDriveCTC.set(1200000);
    this.newDriveMinCGPA.set(7.0);
    this.newDriveMaxBacklogs.set(0);
    this.newDriveDeadline.set('');
    this.selectedBranches.set(['CSE', 'IT', 'ECE']);
    this.newDriveHasAptitude.set(false);
    this.newDriveHasGD.set(false);
  }

  protected getMeaningfulError(val: string, fieldName: 'title' | 'description' = 'title'): string | null {
    if (!val || !val.trim()) return null;
    const control = new FormControl(val);
    const errors = meaningfulTextValidator(control);
    if (!errors) return null;
    if (errors['tooFewLetters']) return 'Please enter at least 2 alphabetic characters.';
    if (errors['noVowel']) {
      return fieldName === 'description' 
        ? 'Please enter a valid, meaningful job description.' 
        : "Please enter a meaningful job title (e.g., 'Cloud Support Associate').";
    }
    if (errors['keyboardMash']) return 'Please enter a valid, meaningful text without keyboard mash (e.g., asdfghjkl).';
    if (errors['repeatingChars']) return "Please avoid repeating characters (e.g., 'aaaa').";
    return null;
  }

  protected isFormInvalid(): boolean {
    const title = this.newDriveTitle()?.trim() || '';
    const desc = this.newDriveDesc()?.trim() || '';
    const ctc = this.newDriveCTC();
    const minCGPA = this.newDriveMinCGPA();
    const maxBacklogs = this.newDriveMaxBacklogs();
    const deadline = this.newDriveDeadline();
    const branches = this.selectedBranches();

    if (!title || title.length < 3 || !!this.getMeaningfulError(title, 'title')) return true;
    if (!desc || desc.length < 10 || !!this.getMeaningfulError(desc, 'description')) return true;
    if (!ctc || ctc < 10000) return true;
    if (!deadline || deadline < this.todayDate) return true;
    if (minCGPA !== undefined && minCGPA !== null && (minCGPA < 0 || minCGPA > 10)) return true;
    if (maxBacklogs !== undefined && maxBacklogs !== null && maxBacklogs < 0) return true;
    if (branches.length === 0) return true;

    return false;
  }

  protected submitCreateDrive(): void {
    if (this.isFormInvalid()) {
      return;
    }

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const payload = {
      title: this.newDriveTitle(),
      description: this.newDriveDesc(),
      ctc: this.newDriveCTC(),
      minCGPA: this.newDriveMinCGPA(),
      eligibleBranches: this.selectedBranches(),
      maxBacklogs: this.newDriveMaxBacklogs(),
      applicationDeadline: this.newDriveDeadline(),
      hasAptitudeTest: this.newDriveHasAptitude(),
      hasGD: this.newDriveHasGD(),
    };

    const isEdit = !!this.editingDriveId();
    const action$ = isEdit
      ? this.recruiterService.updateDrive(this.editingDriveId()!, payload)
      : this.recruiterService.createDrive(payload);

    action$.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.resetForm();
        this.successMessage.set(
          isEdit 
            ? 'Drive updated successfully!'
            : '✅ Drive submitted for TPO approval. You will be notified once it\'s live.'
        );
        this.fetchDrives();
        setTimeout(() => {
          this.successMessage.set(null);
        }, 10000);
      },
      error: (err) => {
        console.error('Submit drive error:', err);
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to submit the job drive. Please try again.');
      },
    });
  }

  protected resubmitDrive(driveId: string): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.recruiterService.resubmitDrive(driveId).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.successMessage.set('✅ Drive resubmitted for TPO approval.');
        this.fetchDrives();
        setTimeout(() => this.successMessage.set(null), 10000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to resubmit drive.');
      }
    });
  }

  // ── Applicant Management Methods ─────────────────────────────────────────
  protected viewApplications(driveId: string, driveTitle: string): void {
    this.router.navigate(['/recruiter/applications', driveId]);
  }

  protected selectApplicant(app: any): void {
    this.selectedApplication.set(app);
  }

  protected closeApplicationsModal(): void {
    this.isApplicationsModalOpen.set(false);
    this.selectedApplication.set(null);
    this.applications.set([]);
  }

  protected exportDrivesToCSV(): void {
    const drivesList = this.drives();
    if (drivesList.length === 0) return;

    // Header row
    const headers = ['Drive ID', 'Title', 'Status', 'Applications Count', 'CTC (LPA)', 'Min CGPA', 'Deadline', 'Has Aptitude', 'Has GD'];
    const rows = drivesList.map((d) => [
      d._id,
      `"${d.title.replace(/"/g, '""')}"`,
      d.status,
      d.applicationsCount,
      (d.ctc / 100000).toFixed(2),
      d.minCGPA,
      new Date(d.applicationDeadline).toLocaleDateString(),
      d.hasAptitudeTest ? 'Yes' : 'No',
      d.hasGD ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Job_Drives_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  protected toggleDropdown(driveId: string): void {
    this.activeDropdown.update((val) => (val === driveId ? null : driveId));
  }

  protected openResourceManager(driveId: string, driveTitle: string): void {
    this.activeDropdown.set(null); // Close the dropdown menu
    this.selectedDriveForResources.set({ id: driveId, title: driveTitle });
  }

  protected closeResourceManager(): void {
    this.selectedDriveForResources.set(null);
  }
}
