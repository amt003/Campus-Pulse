import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-recruiter-all-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './all-applications.html',
  styleUrl: './all-applications.css'
})
export class RecruiterAllApplicationsComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected applications = signal<any[]>([]);
  protected isLoading = signal<boolean>(true);

  // Filters
  protected searchTerm = signal<string>('');
  protected selectedDriveId = signal<string>('all');
  protected selectedStatus = signal<string>('all');

  protected uniqueDrives = computed(() => {
    const map = new Map<string, string>();
    for (const app of this.applications()) {
      if (app.driveId && app.driveId._id) {
        map.set(app.driveId._id, app.driveId.title || 'Untitled Drive');
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  });

  protected availableStatuses = [
    'all',
    'Applied',
    'Under Review',
    'Aptitude Scheduled',
    'GD Scheduled',
    'Interview Scheduled',
    'Selected',
    'Offer Sent',
    'Offer Accepted',
    'Placed',
    'Rejected'
  ];

  ngOnInit(): void {
    this.fetchApplications();
  }

  protected fetchApplications(): void {
    this.isLoading.set(true);
    this.recruiterService.getAllApplications().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.applications) {
          this.applications.set(res.applications);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error('Failed to load applications', err.error?.message || 'Try again later');
      }
    });
  }

  protected filteredApplications = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const driveId = this.selectedDriveId();
    const status = this.selectedStatus();

    return this.applications().filter(app => {
      const studentName = app.studentId?.userId?.name?.toLowerCase() || '';
      const rollNumber = app.studentId?.rollNumber?.toLowerCase() || '';
      const driveTitle = app.driveId?.title?.toLowerCase() || '';

      const matchesSearch = !term || 
        studentName.includes(term) || 
        rollNumber.includes(term) || 
        driveTitle.includes(term);

      const matchesDrive = driveId === 'all' || app.driveId?._id === driveId;
      const matchesStatus = status === 'all' || app.status === status;

      return matchesSearch && matchesDrive && matchesStatus;
    });
  });

  protected getStatusBadgeClass(status: string): string {
    if (['Selected', 'Placed', 'Offer Accepted'].includes(status)) return 'badge-success';
    if (['Rejected', 'Offer Declined'].includes(status)) return 'badge-danger';
    if (status.includes('Scheduled') || status === 'Offer Sent') return 'badge-info';
    return 'badge-neutral';
  }

  protected getDisplayStatus(app: any): string {
    if (app.isPlacedElsewhere || (app.placementCompany && !app.isPlacedInThisDrive)) {
      return `✅ Placed at ${app.placementCompany || 'another company'}`;
    }
    const offerStatus = app.offer?.status;
    if (offerStatus === 'Accepted' || app.status === 'Offer Accepted' || app.status === 'Placed') {
      return 'Offer Accepted 🎉';
    }
    if (offerStatus === 'Sent' || app.status === 'Offer Sent') {
      return 'Offer Sent';
    }
    if (offerStatus === 'Declined' || app.status === 'Offer Declined') {
      return 'Offer Declined ❌';
    }
    return app.status;
  }

  protected downloadOfferLetter(appId: string): void {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const downloadUrl = `http://localhost:5000/api/recruiter/offer/${appId}/pdf?token=${token}`;
    window.open(downloadUrl, '_blank');
  }

  protected viewDriveApplications(driveId: string): void {
    if (driveId) {
      this.router.navigate(['/recruiter/applications', driveId]);
    }
  }

  protected generateOffer(appId: string): void {
    this.router.navigate(['/recruiter/offer', appId]);
  }
}
