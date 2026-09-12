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
  protected pendingDriveCount = signal<number>(0);
  protected upcomingSchedulesCount = signal<number>(0);

  // Action states
  protected isApproving = signal<string | null>(null);
  protected isRejecting = signal<string | null>(null);

  // On Hold Modal state
  protected isHoldModalOpen = signal<boolean>(false);
  protected selectedRecruiterForHold = signal<PendingRecruiter | null>(null);
  protected holdFeedbackInput = signal<string>('');
  protected holdSuggestionsInput = signal<string>('');
  protected isSubmittingHold = signal<boolean>(false);
  protected holdErrorMsg = signal<string | null>(null);

  // Bulk Import state
  protected isImportModalOpen = signal<boolean>(false);
  protected importRawInput = signal<string>('');
  protected previewStudents = signal<any[]>([]);
  protected isImporting = signal<boolean>(false);
  protected importSuccessMsg = signal<string | null>(null);
  protected importErrorMsg = signal<string | null>(null);

  protected currentUser = signal<{ name: string; email: string; role: string } | null>(null);
  protected seasonConfig = signal<{ seasonStart: string; seasonEnd: string } | null>(null);

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
    this.loadCollegeConfig();
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
      this.tpoService.getPendingDrives().toPromise(),
      this.tpoService.getSeasonConfig().toPromise(),
      this.tpoService.getCalendarSummary().toPromise(),
    ])
      .then(([analytics, funnel, branch, offer, pending, approved, pendingDrives, seasonRes, calendarRes]) => {
        this.analytics.set(analytics || this.zeroAnalytics);
        this.funnelData.set(funnel && funnel.length > 0 ? funnel : this.zeroFunnel);
        this.branchStats.set(branch && branch.length > 0 ? branch : this.zeroBranchStats);
        this.offerTrends.set(offer || this.zeroOfferTrends);
        this.pendingRecruiters.set(pending || []);
        this.approvedRecruiters.set(approved || []);
        this.pendingDriveCount.set(pendingDrives?.drives?.length || 0);
        this.upcomingSchedulesCount.set(calendarRes?.summary?.totalThisMonth || calendarRes?.summary?.totalStudentsScheduled || 0);
        if (seasonRes && seasonRes.data) {
          this.seasonConfig.set(seasonRes.data);
        }

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

  protected openHoldModal(rec: PendingRecruiter): void {
    this.selectedRecruiterForHold.set(rec);
    this.holdFeedbackInput.set('');
    this.holdSuggestionsInput.set('');
    this.holdErrorMsg.set(null);
    this.isHoldModalOpen.set(true);
  }

  protected closeHoldModal(): void {
    this.isHoldModalOpen.set(false);
    this.selectedRecruiterForHold.set(null);
  }

  protected submitPutOnHold(): void {
    const rec = this.selectedRecruiterForHold();
    if (!rec) return;

    const feedback = this.holdFeedbackInput().trim();
    if (!feedback) {
      this.holdErrorMsg.set('Please enter feedback explaining why this recruiter account is being put on hold.');
      return;
    }

    this.isSubmittingHold.set(true);
    this.holdErrorMsg.set(null);

    this.tpoService.putRecruiterOnHold(rec._id, {
      feedback,
      suggestions: this.holdSuggestionsInput().trim()
    }).subscribe({
      next: () => {
        this.isSubmittingHold.set(false);
        this.pendingRecruiters.set(this.pendingRecruiters().filter((r) => r._id !== rec._id));
        this.closeHoldModal();
        this.loadAllDashboardData(false);
      },
      error: (err) => {
        this.isSubmittingHold.set(false);
        this.holdErrorMsg.set(err?.error?.message || 'Failed to put recruiter on hold.');
      }
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

  // Single / Bulk Import state
  protected importMode = signal<'single' | 'bulk'>('single');
  protected singleRoll = signal<string>('');
  protected singleName = signal<string>('');
  protected singleEmail = signal<string>('');
  protected singleBranch = signal<string>('CSE');
  protected singleCgpa = signal<number | null>(8.5);
  protected singlePassoutYear = signal<number>(2026);
  protected availableBranches = signal<string[]>(['CSE', 'IT', 'ECE', 'INMCA', 'MCA', 'BCA', 'EEE', 'ME', 'CE', 'AD']);

  private loadCollegeConfig(): void {
    this.tpoService.getCollegeConfig().subscribe({
      next: (res) => {
        if (res && res.data && Array.isArray(res.data.branches) && res.data.branches.length > 0) {
          this.availableBranches.set(res.data.branches);
          if (res.data.branches.length > 0 && !res.data.branches.includes(this.singleBranch())) {
            this.singleBranch.set(res.data.branches[0]);
          }
        }
      },
      error: (err) => console.error('Failed to load college config:', err)
    });
  }

  // --- Student Import Handlers ---
  protected openImportModal(): void {
    this.isImportModalOpen.set(true);
    this.importMode.set('single');
    this.singleRoll.set('');
    this.singleName.set('');
    this.singleEmail.set('');
    this.singleBranch.set('CSE');
    this.singleCgpa.set(8.5);
    this.singlePassoutYear.set(2026);
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
    const currentYear = new Date().getFullYear();
    const r = Math.floor(100 + Math.random() * 900);
    const sample = [
      { rollNumber: `CS26B${r}`, name: `Aarav Sharma`, email: `aarav.${r}@alphabet.edu`, cgpa: 9.1, branch: 'CSE', passoutYear: currentYear, activeBacklogs: 0 },
    ];
    this.importRawInput.set(JSON.stringify(sample, null, 2));
    this.previewStudents.set(sample);
  }

  protected submitBulkImport(): void {
    this.importErrorMsg.set(null);
    this.importSuccessMsg.set(null);
    let dataToImport: any[] = [];

    if (this.importMode() === 'single') {
      const roll = this.singleRoll().trim();
      const name = this.singleName().trim();
      const email = this.singleEmail().trim();
      const cgpa = this.singleCgpa();

      if (!roll || !name || !email || cgpa === null || cgpa === undefined) {
        this.importErrorMsg.set('Please fill out all required fields (Roll Number, Name, Email, CGPA).');
        return;
      }

      dataToImport = [{
        rollNumber: roll,
        name: name,
        email: email,
        cgpa: Number(cgpa),
        branch: this.singleBranch().trim(),
        passoutYear: Number(this.singlePassoutYear() || 2026),
        activeBacklogs: 0
      }];
    } else {
      dataToImport = this.previewStudents();

      if (dataToImport.length === 0 && this.importRawInput().trim()) {
        try {
          const parsed = JSON.parse(this.importRawInput().trim());
          dataToImport = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          this.importErrorMsg.set('Invalid JSON format. Please check your JSON input syntax.');
          return;
        }
      }
    }

    if (dataToImport.length === 0) {
      this.importErrorMsg.set('Please enter student details or select a CSV file to import.');
      return;
    }

    this.isImporting.set(true);
    this.tpoService.importStudents(dataToImport).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        if (res && res.importedCount > 0) {
          this.importSuccessMsg.set(res.message || 'Student(s) imported successfully!');
          this.loadAllDashboardData(false);
          setTimeout(() => this.closeImportModal(), 1800);
        } else if (res && res.errorsCount > 0) {
          const errDetail = res.errors?.[0]?.error || res.message || 'Failed to import student.';
          this.importErrorMsg.set(errDetail);
        } else {
          this.importErrorMsg.set(res?.message || 'No students were imported.');
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        const errDetail = err.error?.message || err.error?.errors?.[0]?.error || 'Failed to import student. Please check for duplicate email or roll number.';
        this.importErrorMsg.set(errDetail);
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

  protected exportDashboardStatsToCSV(): void {
    const stats = this.branchStats();
    if (stats.length === 0) return;

    const csvRows: string[] = [];

    // Section 1: General Placement Cell Overview
    csvRows.push('=== GENERAL PLACEMENT CELL OVERVIEW ===');
    csvRows.push('Metric,Value');
    const ann = this.analytics() || this.zeroAnalytics;
    csvRows.push(`Total Registered Students,${ann.totalStudents}`);
    csvRows.push(`Total Placed Students,${ann.totalPlaced}`);
    csvRows.push(`Unplaced Students,${ann.totalUnplaced}`);
    csvRows.push(`Overall Placement Rate (%),${ann.placementPercentage}%`);
    csvRows.push(`Active Placement Drives,${ann.activeDrives}`);
    csvRows.push('');

    // Section 2: Recruitment Pipeline Funnel
    csvRows.push('=== RECRUITMENT PIPELINE FUNNEL ===');
    csvRows.push('Evaluation Stage,Candidates Count');
    const funnel = this.funnelData();
    funnel.forEach((f) => {
      csvRows.push(`"${f.stage}",${f.count}`);
    });
    csvRows.push('');

    // Section 3: Branch-wise Statistics
    csvRows.push('=== BRANCH-WISE PLACEMENT STATISTICS ===');
    csvRows.push('Branch,Total Students,Placed Students,Placement Rate (%)');
    stats.forEach((b) => {
      csvRows.push(`"${b.branch}",${b.total},${b.placed},${b.percentage}%`);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `TPO_Placement_Cell_Stats_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  ngOnDestroy(): void {
    if (this.livePollingTimer) clearInterval(this.livePollingTimer);
  }
}
