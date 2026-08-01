import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecruiterService, RecruiterProfile } from '../../../services/recruiter.service';

export interface DriveItem {
  _id: string;
  title: string;
  status: 'Draft' | 'Open' | 'Closed';
  applicationsCount: number;
  applicationDeadline: string;
  ctc: number;
  minCGPA: number;
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class RecruiterDashboardComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly router = inject(Router);

  protected isLoading = signal<boolean>(true);
  protected profile = signal<RecruiterProfile | null>(null);
  protected drives = signal<DriveItem[]>([]);
  protected isRefreshing = signal<boolean>(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected isSubmitting = signal<boolean>(false);

  // Stats for Approved State
  protected activeDrivesCount = signal<number>(0);
  protected totalApplicationsCount = signal<number>(0);
  protected shortlistedCount = signal<number>(0);
  protected offerAcceptanceRate = signal<number>(91);

  // Create Drive Modal / Form placeholder
  protected isCreateModalOpen = signal<boolean>(false);
  protected newDriveTitle = signal<string>('');
  protected newDriveCTC = signal<number>(1200000);
  protected newDriveMinCGPA = signal<number>(7.0);
  protected newDriveMaxBacklogs = signal<number>(0);
  protected newDriveDeadline = signal<string>('');
  protected newDriveDesc = signal<string>('');
  
  protected availableBranches = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'MCA'];
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
      },
      error: (err) => {
        console.error('Failed to fetch drives:', err);
      },
    });
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

  // Create Drive Handler
  protected openCreateModal(): void {
    this.errorMessage.set(null);
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.newDriveTitle.set('');
    this.newDriveDesc.set('');
    this.newDriveCTC.set(1200000);
    this.newDriveMinCGPA.set(7.0);
    this.newDriveMaxBacklogs.set(0);
    this.newDriveDeadline.set('');
    this.selectedBranches.set(['CSE', 'IT', 'ECE']);
  }

  protected isFormInvalid(): boolean {
    const title = this.newDriveTitle()?.trim() || '';
    const desc = this.newDriveDesc()?.trim() || '';
    const ctc = this.newDriveCTC();
    const minCGPA = this.newDriveMinCGPA();
    const maxBacklogs = this.newDriveMaxBacklogs();
    const deadline = this.newDriveDeadline();
    const branches = this.selectedBranches();

    if (!title || title.length < 3) return true;
    if (!desc || desc.length < 10) return true;
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
      status: 'Open',
    };

    this.recruiterService.createDrive(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeCreateModal();
        this.successMessage.set('Placement drive published successfully!');
        this.fetchDrives();
        setTimeout(() => {
          this.successMessage.set(null);
        }, 4000);
      },
      error: (err) => {
        console.error('Create drive error:', err);
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to publish the job drive. Please try again.');
      },
    });
  }
}
