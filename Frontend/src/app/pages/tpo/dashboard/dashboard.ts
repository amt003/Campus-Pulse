import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  TpoService,
  DashboardAnalytics,
  FunnelStage,
  BranchStat,
  OfferTrends,
  PendingRecruiter,
} from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class TpoDashboardComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Active Nav Tab
  protected activeTab = signal<'dashboard' | 'import' | 'approve'>('dashboard');

  // Live Sync status
  protected isLiveSync = signal<boolean>(true);
  protected lastUpdatedText = signal<string>('Just now');
  protected isRefreshing = signal<boolean>(false);

  protected isLoading = signal<boolean>(true);
  protected analytics = signal<DashboardAnalytics | null>(null);
  protected funnelData = signal<FunnelStage[]>([]);
  protected branchStats = signal<BranchStat[]>([]);
  protected offerTrends = signal<OfferTrends | null>(null);
  protected pendingRecruiters = signal<PendingRecruiter[]>([]);
  protected approvedRecruiters = signal<PendingRecruiter[]>([]);

  // Action states
  protected isApproving = signal<string | null>(null);
  protected isRejecting = signal<string | null>(null);

  // Bulk Import state
  protected isImportModalOpen = signal<boolean>(false);
  protected importRawInput = signal<string>('');
  protected previewStudents = signal<any[]>([]);
  protected isImporting = signal<boolean>(false);
  protected importSuccessMsg = signal<string | null>(null);
  protected importErrorMsg = signal<string | null>(null);

  protected currentUser = signal<{ name: string; email: string; role: string } | null>(null);

  // Pagination for pending table
  protected currentPage = signal<number>(1);
  protected pageSize = 5;

  private livePollingTimer?: ReturnType<typeof setInterval>;

  // Zero/null default structures when database has no records yet
  private readonly zeroAnalytics: DashboardAnalytics = {
    totalStudents: 0,
    totalPlaced: 0,
    totalUnplaced: 0,
    placementPercentage: 0,
    activeDrives: 0,
    pendingApprovals: 0,
  };

  private readonly zeroFunnel: FunnelStage[] = [
    { stage: 'Applied', count: 0 },
    { stage: 'Aptitude Cleared', count: 0 },
    { stage: 'GD Cleared', count: 0 },
    { stage: 'Interviewed', count: 0 },
    { stage: 'Placed', count: 0 },
  ];

  private readonly zeroBranchStats: BranchStat[] = [
    { branch: 'BCA', total: 0, placed: 0, percentage: 0 },
    { branch: 'MCA', total: 0, placed: 0, percentage: 0 },
    { branch: 'INMCA', total: 0, placed: 0, percentage: 0 },
    { branch: 'ECE', total: 0, placed: 0, percentage: 0 },
    { branch: 'CSE', total: 0, placed: 0, percentage: 0 },
    { branch: 'IT', total: 0, placed: 0, percentage: 0 },
    { branch: 'EEE', total: 0, placed: 0, percentage: 0 },
    { branch: 'ME', total: 0, placed: 0, percentage: 0 },
    { branch: 'CE', total: 0, placed: 0, percentage: 0 },
    { branch: 'AD', total: 0, placed: 0, percentage: 0 },
  ];

  private readonly zeroOfferTrends: OfferTrends = {
    totalOffers: 0,
    accepted: 0,
    declined: 0,
    acceptanceRate: 0,
  };

  ngOnInit(): void {
    this.loadAllDashboardData(true);
    // Real-time Live Polling every 5 seconds
    this.livePollingTimer = setInterval(() => {
      this.loadAllDashboardData(false);
    }, 5000);

    this.route.queryParams.subscribe((params) => {
      if (params['import'] === 'true') {
        this.openImportModal();
      }
    });
  }

  protected loadAllDashboardData(isInitial = false): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    Promise.all([
      this.tpoService.getAnalytics().toPromise(),
      this.tpoService.getFunnel().toPromise(),
      this.tpoService.getBranchStats().toPromise(),
      this.tpoService.getOfferTrends().toPromise(),
      this.tpoService.getPendingRecruiters().toPromise(),
      this.tpoService.getApprovedRecruiters().toPromise(),
    ])
      .then(([analytics, funnel, branch, offer, pending, approved]) => {
        this.analytics.set(analytics || this.zeroAnalytics);
        this.funnelData.set(funnel && funnel.length > 0 ? funnel : this.zeroFunnel);
        this.branchStats.set(branch && branch.length > 0 ? branch : this.zeroBranchStats);
        this.offerTrends.set(offer || this.zeroOfferTrends);
        this.pendingRecruiters.set(pending || []);
        this.approvedRecruiters.set(approved || []);

        this.lastUpdatedText.set(new Date().toLocaleTimeString());
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      })
      .catch((err) => {
        console.error('Failed to load TPO data from database:', err);
        this.analytics.set(this.zeroAnalytics);
        this.funnelData.set(this.zeroFunnel);
        this.branchStats.set(this.zeroBranchStats);
        this.offerTrends.set(this.zeroOfferTrends);

        this.lastUpdatedText.set(new Date().toLocaleTimeString());
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      });
  }

  protected refreshData(): void {
    this.loadAllDashboardData(false);
  }

  protected switchTab(tab: 'dashboard' | 'import' | 'approve'): void {
    this.activeTab.set(tab);
    if (tab === 'import') {
      this.openImportModal();
    } else if (tab === 'approve') {
      this.router.navigate(['/tpo/approval']);
    }
  }

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  protected downloadPDF(): void {
    window.print();
  }

  // --- Recruiter Approvals ---
  protected approveRecruiter(id: string): void {
    this.isApproving.set(id);
    this.tpoService.approveRecruiter(id).subscribe({
      next: () => {
        this.isApproving.set(null);
        this.pendingRecruiters.set(this.pendingRecruiters().filter((r) => r._id !== id));
        this.loadAllDashboardData(false);
      },
      error: () => this.isApproving.set(null),
    });
  }

  protected rejectRecruiter(id: string): void {
    this.isRejecting.set(id);
    this.tpoService.rejectRecruiter(id).subscribe({
      next: () => {
        this.isRejecting.set(null);
        this.pendingRecruiters.set(this.pendingRecruiters().filter((r) => r._id !== id));
        this.loadAllDashboardData(false);
      },
      error: () => this.isRejecting.set(null),
    });
  }

  protected isTogglingStatus = signal<string | null>(null);

  protected toggleRecruiterActiveStatus(id: string): void {
    this.isTogglingStatus.set(id);
    this.tpoService.toggleRecruiterStatus(id).subscribe({
      next: () => {
        this.isTogglingStatus.set(null);
        this.loadAllDashboardData(false);
      },
      error: (err) => {
        console.error('Failed to toggle status:', err);
        this.isTogglingStatus.set(null);
      },
    });
  }

  protected getTrustScoreClass(score?: number): string {
    const s = score || 0;
    if (s >= 80) return 'trust-high';
    if (s >= 60) return 'trust-med';
    return 'trust-low';
  }

  protected get paginatedRecruiters(): PendingRecruiter[] {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.pendingRecruiters().slice(start, start + this.pageSize);
  }

  protected get totalPages(): number {
    return Math.ceil(this.pendingRecruiters().length / this.pageSize) || 1;
  }

  protected setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
    }
  }

  // --- Bulk Import ---
  protected openImportModal(): void {
    this.isImportModalOpen.set(true);
    this.importRawInput.set('');
    this.previewStudents.set([]);
    this.importSuccessMsg.set(null);
    this.importErrorMsg.set(null);
  }

  protected closeImportModal(): void {
    this.isImportModalOpen.set(false);
    this.activeTab.set('dashboard');
  }

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.parseCSV(text);
    };
    reader.readAsText(file);
  }

  protected parseCSV(text: string): void {
    try {
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const parsed: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        parsed.push(obj);
      }

      this.previewStudents.set(parsed);
    } catch (e) {
      console.error('CSV parse error:', e);
    }
  }

  protected loadSampleJSON(): void {
    const sample = [
      { rollNumber: 'CS24B001', name: 'Aarav Sharma', email: 'aarav@alphabet.edu', cgpa: 9.1, branch: 'CSE', passoutYear: 2024, activeBacklogs: 0 },
      { rollNumber: 'IT24B002', name: 'Diya Patel', email: 'diya@alphabet.edu', cgpa: 8.5, branch: 'IT', passoutYear: 2024, activeBacklogs: 0 },
      { rollNumber: 'EC24B003', name: 'Rohan Gupta', email: 'rohan@alphabet.edu', cgpa: 7.8, branch: 'ECE', passoutYear: 2024, activeBacklogs: 0 },
    ];
    this.importRawInput.set(JSON.stringify(sample, null, 2));
    this.previewStudents.set(sample);
  }

  protected submitBulkImport(): void {
    const data = this.previewStudents();
    if (data.length === 0) return;

    this.isImporting.set(true);
    this.tpoService.importStudents(data).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        this.importSuccessMsg.set(res.message || 'Students imported successfully!');
        this.loadAllDashboardData(false);
        setTimeout(() => this.closeImportModal(), 2000);
      },
      error: (err) => {
        this.isImporting.set(false);
        this.importErrorMsg.set(err.error?.message || 'Failed to import students');
      },
    });
  }

  // --- Funnel bar width helper ---
  protected getFunnelBarWidth(count: number): number {
    const max = Math.max(...this.funnelData().map((f) => f.count), 1);
    if (max === 0 || count === 0) return 0;
    return Math.min(100, Math.max(8, (count / max) * 100));
  }

  // --- Funnel bar color helper ---
  protected getFunnelBarColor(stage: string): string {
    const map: Record<string, string> = {
      'Applied': 'linear-gradient(90deg, #003b5a, #005a8a)',
      'Aptitude Cleared': 'linear-gradient(90deg, #005a8a, #0074a8)',
      'GD Cleared': 'linear-gradient(90deg, #0074a8, #0093d6)',
      'Interviewed': 'linear-gradient(90deg, #0093d6, #3bb5ff)',
      'Placed': 'linear-gradient(90deg, #2e7d32, #43a047)',
    };
    return map[stage] || 'linear-gradient(90deg, #003b5a, #006497)';
  }

  ngOnDestroy(): void {
    if (this.livePollingTimer) clearInterval(this.livePollingTimer);
  }
}
