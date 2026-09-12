import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TpoService, DriveOverview } from '../../../services/tpo.service';
import { ToastService } from '../../../services/toast.service';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

@Component({
  selector: 'app-tpo-oversee-drives',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './oversee-drives.component.html',
  styleUrl: './oversee-drives.component.css'
})
export class TpoOverseeDrivesComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly smoothScrollService = inject(SmoothScrollService);

  protected drives = signal<DriveOverview[]>([]);
  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  protected searchTerm = signal<string>('');
  protected selectedStatus = signal<string>('ALL');

  // Quick View Modal
  protected isViewModalOpen = signal<boolean>(false);
  protected selectedDrive = signal<DriveOverview | null>(null);

  // Status options for filtering
  protected statusOptions = [
    { label: 'All Drives', value: 'ALL' },
    { label: 'Open', value: 'Open' },
    { label: 'Pending Approval', value: 'Pending' },
    { label: 'Closed', value: 'Closed' },
    { label: 'On Hold', value: 'OnHold' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  // Metrics
  protected totalDrivesCount = computed(() => this.drives().length);
  protected openDrivesCount = computed(() => this.drives().filter(d => d.status === 'Open').length);
  protected totalApplicationsCount = computed(() => this.drives().reduce((acc, d) => acc + (d.applicationCount || 0), 0));
  protected totalPlacedCount = computed(() => this.drives().reduce((acc, d) => acc + (d.placedCount || 0), 0));

  ngOnInit(): void {
    this.fetchDrives();
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll(true);
  }

  protected fetchDrives(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.tpoService.getAllDrives().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (res && res.drives) {
          this.drives.set(res.drives);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.toastService.error('Failed to load drives', err.error?.message || 'Try again later');
      }
    });
  }

  protected get filteredDrives(): DriveOverview[] {
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.selectedStatus();

    return this.drives().filter(d => {
      const matchSearch = !term ||
        (d.title || '').toLowerCase().includes(term) ||
        (d.recruiter?.companyName || '').toLowerCase().includes(term);

      const matchStatus = status === 'ALL' || d.status === status;

      return matchSearch && matchStatus;
    });
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected isPastDeadline(deadlineStr: string): boolean {
    if (!deadlineStr) return false;
    return new Date(deadlineStr).getTime() < new Date().getTime();
  }

  protected openViewModal(drive: DriveOverview, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedDrive.set(drive);
    this.isViewModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeViewModal(): void {
    if (this.isViewModalOpen()) {
      this.isViewModalOpen.set(false);
      this.selectedDrive.set(null);
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  protected navigateToXray(driveId: string): void {
    this.closeViewModal();
    this.router.navigate(['/tpo/drive-xray', driveId]);
  }
}
