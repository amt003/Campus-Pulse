import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';
import { ManageResourcesModalComponent } from '../../../components/modals/manage-resources-modal/manage-resources-modal.component';

@Component({
  selector: 'app-recruiter-drives',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ManageResourcesModalComponent],
  templateUrl: './drives.html',
  styleUrl: './drives.css'
})
export class RecruiterDrivesComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected drives = signal<any[]>([]);
  protected isLoading = signal<boolean>(true);
  protected filterStatus = signal<'all' | 'active' | 'closed'>('all');
  protected searchTerm = signal<string>('');

  // Resources Modal state
  protected isResourcesModalOpen = signal<boolean>(false);
  protected selectedDriveForResources = signal<any | null>(null);

  // Close Drive Modal state
  protected isCloseModalOpen = signal<boolean>(false);
  protected selectedDriveToClose = signal<any | null>(null);
  protected closeReason = signal<string>('');
  protected isClosing = signal<boolean>(false);

  ngOnInit(): void {
    this.fetchDrives();
  }

  protected fetchDrives(): void {
    this.isLoading.set(true);
    this.recruiterService.getDrives().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.drives) {
          this.drives.set(res.drives);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error('Failed to load drives', err.error?.message || 'Try again later');
      }
    });
  }

  protected filteredDrives = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.filterStatus();

    return this.drives().filter(drive => {
      const matchesSearch = !term || 
        drive.title?.toLowerCase().includes(term) || 
        drive.companyName?.toLowerCase().includes(term) ||
        drive.description?.toLowerCase().includes(term);

      const isClosed = drive.status === 'Closed' || drive.status === 'Expired' || new Date(drive.applicationDeadline) < new Date();
      let matchesStatus = true;
      if (status === 'active') matchesStatus = !isClosed;
      if (status === 'closed') matchesStatus = isClosed;

      return matchesSearch && matchesStatus;
    });
  });

  protected isDriveClosed(drive: any): boolean {
    return drive.status === 'Closed' || drive.status === 'Expired' || new Date(drive.applicationDeadline) < new Date();
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected openResourcesModal(drive: any, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedDriveForResources.set(drive);
    this.isResourcesModalOpen.set(true);
  }

  protected closeResourcesModal(): void {
    this.isResourcesModalOpen.set(false);
    this.selectedDriveForResources.set(null);
  }

  protected openCloseDriveModal(drive: any, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedDriveToClose.set(drive);
    this.closeReason.set('');
    this.isCloseModalOpen.set(true);
  }

  protected cancelCloseDriveModal(): void {
    this.isCloseModalOpen.set(false);
    this.selectedDriveToClose.set(null);
    this.closeReason.set('');
  }

  protected confirmCloseDrive(): void {
    const drive = this.selectedDriveToClose();
    if (!drive) return;

    this.isClosing.set(true);
    const reason = this.closeReason().trim();

    this.recruiterService.closeDrive(drive._id, reason).subscribe({
      next: () => {
        this.isClosing.set(false);
        this.isCloseModalOpen.set(false);
        this.selectedDriveToClose.set(null);
        this.closeReason.set('');
        this.toastService.success('Drive closed', 'Application window is now closed for this drive');
        this.fetchDrives();
      },
      error: (err) => {
        this.isClosing.set(false);
        this.toastService.error('Failed to close drive', err.error?.message || 'Try again later');
      }
    });
  }

  protected viewApplicants(driveId: string): void {
    this.router.navigate(['/recruiter/applications', driveId]);
  }
}
