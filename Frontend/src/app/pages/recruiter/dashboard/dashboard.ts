import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RecruiterService, RecruiterProfile } from '../../../services/recruiter.service';

export interface DriveItem {
  _id: string;
  title: string;
  status: 'Draft' | 'Open' | 'Closed';
  applicationsCount: number;
  applicationDeadline: string;
  ctc: number;
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  protected newDriveDeadline = signal<string>('');
  protected newDriveDesc = signal<string>('');

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

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  // Create Drive Handler
  protected openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  protected submitCreateDrive(): void {
    if (!this.newDriveTitle()) return;

    const payload = {
      title: this.newDriveTitle(),
      description: this.newDriveDesc() || 'Core Engineering Role',
      ctc: this.newDriveCTC(),
      minCGPA: this.newDriveMinCGPA(),
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      maxBacklogs: 0,
      applicationDeadline: this.newDriveDeadline() || new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'Open',
    };

    this.recruiterService.createDrive(payload).subscribe({
      next: () => {
        this.closeCreateModal();
        this.fetchDrives();
      },
      error: (err) => {
        console.error('Create drive error:', err);
        this.closeCreateModal();
      },
    });
  }
}
