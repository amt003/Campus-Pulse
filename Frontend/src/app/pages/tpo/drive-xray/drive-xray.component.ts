import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TpoService, DriveXRayData, DriveXRayApplication } from '../../../services/tpo.service';
import { ToastService } from '../../../services/toast.service';
import { SmoothScrollService } from '../../../services/smooth-scroll.service';

@Component({
  selector: 'app-tpo-drive-xray',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './drive-xray.component.html',
  styleUrl: './drive-xray.component.css'
})
export class TpoDriveXrayComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly smoothScrollService = inject(SmoothScrollService);

  protected driveId: string = '';
  protected xrayData = signal<DriveXRayData | null>(null);
  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);

  // Filters
  protected searchTerm = signal<string>('');
  protected selectedStatus = signal<string>('ALL');
  protected selectedBranch = signal<string>('ALL');

  // Stage Inspector Modal
  protected isStageModalOpen = signal<boolean>(false);
  protected inspectApp = signal<DriveXRayApplication | null>(null);

  // XAI Modal
  protected isXaiModalOpen = signal<boolean>(false);
  protected xaiApp = signal<DriveXRayApplication | null>(null);

  // Available Filter Options
  protected statusFilterOptions = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Applied', value: 'Applied' },
    { label: 'Aptitude Passed', value: 'Aptitude Passed' },
    { label: 'Aptitude Failed', value: 'Aptitude Failed' },
    { label: 'GD Shortlisted', value: 'GD Shortlisted' },
    { label: 'GD Rejected', value: 'GD Rejected' },
    { label: 'Interview Selected', value: 'Interview Selected' },
    { label: 'Interview Rejected', value: 'Interview Rejected' },
    { label: 'Offer Sent', value: 'Offer Sent' },
    { label: 'Offer Accepted', value: 'Offer Accepted' },
    { label: 'Offer Declined', value: 'Offer Declined' },
    { label: 'Placed', value: 'Placed' },
    { label: 'Rejected', value: 'Rejected' },
  ];

  // Unique branches present in current applications
  protected availableBranches = computed(() => {
    const apps = this.xrayData()?.applications || [];
    const branches = new Set<string>();
    apps.forEach(a => {
      if (a.student?.branch) branches.add(a.student.branch);
    });
    return Array.from(branches).sort();
  });

  // Filtered Applications
  protected filteredApplications = computed(() => {
    const data = this.xrayData();
    if (!data || !data.applications) return [];

    const search = this.searchTerm().toLowerCase().trim();
    const status = this.selectedStatus();
    const branch = this.selectedBranch();

    return data.applications.filter(app => {
      // Search
      const matchSearch = !search ||
        (app.student?.name || '').toLowerCase().includes(search) ||
        (app.student?.rollNumber || '').toLowerCase().includes(search) ||
        (app.student?.email || '').toLowerCase().includes(search);

      // Branch
      const matchBranch = branch === 'ALL' || app.student?.branch === branch;

      // Status
      let matchStatus = true;
      if (status !== 'ALL') {
        const sLower = (app.status || '').toLowerCase();
        if (status === 'Applied') matchStatus = sLower === 'applied';
        else if (status === 'Aptitude Passed') matchStatus = app.aptitude?.status === 'Passed';
        else if (status === 'Aptitude Failed') matchStatus = app.aptitude?.status === 'Failed';
        else if (status === 'GD Shortlisted') matchStatus = app.gd?.status === 'Shortlisted';
        else if (status === 'GD Rejected') matchStatus = app.gd?.status === 'Rejected';
        else if (status === 'Interview Selected') matchStatus = app.interview?.result === 'Selected';
        else if (status === 'Interview Rejected') matchStatus = app.interview?.result === 'Rejected';
        else if (status === 'Offer Sent') matchStatus = app.offer?.status === 'Sent';
        else if (status === 'Offer Accepted') matchStatus = app.offer?.status === 'Accepted';
        else if (status === 'Offer Declined') matchStatus = app.offer?.status === 'Declined';
        else if (status === 'Placed') matchStatus = sLower === 'placed' || app.offer?.status === 'Accepted';
        else if (status === 'Rejected') matchStatus = sLower === 'rejected' || app.interview?.result === 'Rejected';
      }

      return matchSearch && matchBranch && matchStatus;
    });
  });

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.driveId = params['driveId'];
      if (this.driveId) {
        this.fetchDriveData();
      }
    });
  }

  ngOnDestroy(): void {
    this.smoothScrollService.unfreezeBackgroundScroll(true);
  }

  protected fetchDriveData(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.tpoService.getDriveApplicationsForTPO(this.driveId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        if (res && res.data) {
          this.xrayData.set(res.data);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.toastService.error('Failed to load Drive X-Ray', err.error?.message || 'Drive not found');
      }
    });
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected getScoreColorClass(score: number | null): string {
    if (score === null || score === undefined) return 'score-na';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-med';
    return 'score-low';
  }

  // Stage Inspector handlers
  protected openStageModal(app: DriveXRayApplication): void {
    this.inspectApp.set(app);
    this.isStageModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeStageModal(): void {
    if (this.isStageModalOpen()) {
      this.isStageModalOpen.set(false);
      this.inspectApp.set(null);
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  // XAI Modal handlers
  protected openXaiModal(app: DriveXRayApplication, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.xaiApp.set(app);
    this.isXaiModalOpen.set(true);
    this.smoothScrollService.freezeBackgroundScroll();
  }

  protected closeXaiModal(): void {
    if (this.isXaiModalOpen()) {
      this.isXaiModalOpen.set(false);
      this.xaiApp.set(null);
      this.smoothScrollService.unfreezeBackgroundScroll();
    }
  }

  protected goBack(): void {
    this.router.navigate(['/tpo/oversee-drives']);
  }

  // Export Filtered Table as CSV
  protected exportCSV(): void {
    const apps = this.filteredApplications();
    if (!apps || apps.length === 0) {
      this.toastService.error('Export Error', 'No data available in current filtered view.');
      return;
    }

    const headers = [
      '#',
      'Roll Number',
      'Student Name',
      'Email',
      'Phone',
      'CGPA',
      'Branch',
      'Passout Year',
      'AI Match Score (%)',
      'Overall Status',
      'Aptitude Status',
      'Aptitude Score',
      'GD Status',
      'GD Score',
      'Interview Result',
      'Interview Score',
      'Offer Status',
      'Applied Date'
    ];

    const rows = apps.map((a, idx) => [
      idx + 1,
      `"${a.student?.rollNumber || 'N/A'}"`,
      `"${a.student?.name || ''}"`,
      `"${a.student?.email || ''}"`,
      `"${a.student?.phone || ''}"`,
      a.student?.cgpa ?? '',
      `"${a.student?.branch || ''}"`,
      a.student?.passoutYear ?? '',
      a.aiMatchScore !== null ? Math.round(a.aiMatchScore) : 'N/A',
      `"${a.status || ''}"`,
      `"${a.aptitude?.status || 'N/A'}"`,
      a.aptitude?.score ?? '',
      `"${a.gd?.status || 'N/A'}"`,
      a.gd?.score ?? '',
      `"${a.interview?.result || 'Pending'}"`,
      a.interview?.score ?? '',
      `"${a.offer?.status || 'Not Sent'}"`,
      `"${a.appliedDate ? new Date(a.appliedDate).toLocaleDateString() : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const driveTitle = (this.xrayData()?.drive?.title || 'Drive').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Drive_XRay_${driveTitle}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('CSV Exported', `Exported ${apps.length} student records.`);
  }
}
