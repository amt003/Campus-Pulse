import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TpoService } from '../../../services/tpo.service';
import { ToastService } from '../../../services/toast.service';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

export interface PendingDrive {
  _id: string;
  title: string;
  description: string;
  ctc: number;
  minCGPA: number;
  eligibleBranches: string[];
  maxBacklogs: number;
  applicationDeadline: string;
  hasAptitudeTest: boolean;
  hasGD: boolean;
  status: string;
  submittedForApprovalAt?: string;
  resubmittedCount?: number;
  recruiterId?: {
    _id: string;
    name?: string;
    email?: string;
    companyName?: string;
    officialEmail?: string;
    website?: string;
  };
  createdAt: string;
}

@Component({
  selector: 'app-tpo-drive-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './drive-approval.component.html',
  styleUrl: './drive-approval.component.css'
})
export class TpoDriveApprovalComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  private readonly toastService = inject(ToastService);
  private readonly smoothScrollService = inject(SmoothScrollService);

  protected pendingDrives = signal<PendingDrive[]>([]);
  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  protected searchTerm = signal<string>('');

  // Modal State
  protected isModalOpen = signal<boolean>(false);
  protected modalMode = signal<'reject' | 'hold'>('hold');
  protected selectedDrive = signal<PendingDrive | null>(null);
  protected feedbackReason = signal<string>('');
  protected isSubmittingModal = signal<boolean>(false);
  protected modalError = signal<string | null>(null);

  // View Drive Details Modal State
  protected isViewDetailsModalOpen = signal<boolean>(false);
  protected viewingDrive = signal<PendingDrive | null>(null);

  ngOnInit(): void {
    this.fetchPendingDrives();
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll(true);
  }

  protected openViewDetailsModal(drive: PendingDrive, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.viewingDrive.set(drive);
    this.isViewDetailsModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeViewDetailsModal(): void {
    if (this.isViewDetailsModalOpen()) {
      this.isViewDetailsModalOpen.set(false);
      this.viewingDrive.set(null);
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  protected fetchPendingDrives(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.tpoService.getPendingDrives().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (res && res.drives) {
          this.pendingDrives.set(res.drives);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.toastService.error('Failed to load pending drives', err.error?.message || 'Try again later');
      }
    });
  }

  protected get filteredDrives(): PendingDrive[] {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.pendingDrives();

    return this.pendingDrives().filter(d => {
      const title = d.title.toLowerCase();
      const comp = (d.recruiterId?.companyName || d.recruiterId?.name || '').toLowerCase();
      return title.includes(term) || comp.includes(term);
    });
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected approveDrive(drive: PendingDrive): void {
    if (!confirm(`Are you sure you want to approve "${drive.title}" by ${drive.recruiterId?.companyName || 'Recruiter'}? It will become live immediately.`)) {
      return;
    }

    this.tpoService.approveDrive(drive._id).subscribe({
      next: (res) => {
        this.toastService.success('Drive Approved 🎉', res.message || 'Students can now apply for this drive.');
        this.pendingDrives.update(list => list.filter(d => d._id !== drive._id));
      },
      error: (err) => {
        this.toastService.error('Approval Failed', err.error?.message || 'Could not approve drive.');
      }
    });
  }

  protected openModal(drive: PendingDrive, mode: 'reject' = 'reject'): void {
    this.selectedDrive.set(drive);
    this.modalMode.set('reject');
    this.feedbackReason.set('');
    this.modalError.set(null);
    this.isModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeModal(): void {
    if (this.isModalOpen()) {
      this.isModalOpen.set(false);
      this.selectedDrive.set(null);
      this.feedbackReason.set('');
      this.modalError.set(null);
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  protected submitModalAction(): void {
    const drive = this.selectedDrive();
    const reason = this.feedbackReason().trim();

    if (!drive) return;

    if (!reason || reason.length < 10) {
      this.modalError.set('Mandatory feedback requirement: Please provide at least 10 characters detailing your rejection reasons.');
      return;
    }

    this.isSubmittingModal.set(true);
    this.modalError.set(null);

    this.tpoService.rejectDrive(drive._id, reason).subscribe({
      next: (res) => {
        this.isSubmittingModal.set(false);
        this.closeModal();
        this.toastService.success('Drive Rejected ❌', res.message || 'Recruiter has been notified of the decision.');
        this.pendingDrives.update(list => list.filter(d => d._id !== drive._id));
      },
      error: (err) => {
        this.isSubmittingModal.set(false);
        this.modalError.set(err.error?.message || 'Failed to reject drive.');
      }
    });
  }
}
