import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { RecruiterService } from '../../../services/recruiter.service';

export interface StudentInfo {
  _id: string;
  name: string;
  rollNumber: string;
  cgpa: number;
  branch: string;
  resumePath?: string;
}

export interface ApplicationInfo {
  applicationId: string;
  appliedDate: string;
  status: string;
  aiMatchScore: number | null;
  student: StudentInfo | null;
  aptitude?: {
    status?: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string;
  };
  gd?: {
    status?: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string;
  };
  interview?: {
    status?: string;
    result?: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string;
  };
  xai?: {
    matchScore?: number;
    positiveSentences?: string[];
    negativeSentences?: string[];
    skillGaps?: string[];
    strongSkills?: string[];
    isOfflineFallback?: boolean;
  };
  isPlacedGlobally?: boolean;
  isPlaced?: boolean;
  placementCompany?: string | null;
}

@Component({
  selector: 'app-recruiter-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './applications.html',
  styleUrl: './applications.css',
})
export class RecruiterApplicationsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recruiterService = inject(RecruiterService);
  private readonly sanitizer = inject(DomSanitizer);
  protected Math = Math;
  protected todayDate = new Date().toISOString().split('T')[0];

  protected driveId: string = '';
  protected driveTitle = signal<string>('Loading Drive...');
  protected driveDescription = signal<string>('');
  protected companyName = signal<string>('Loading Company...');
  protected driveHasAptitude = signal<boolean>(true);
  protected driveHasGD = signal<boolean>(true);
  protected applications = signal<ApplicationInfo[]>([]);
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  // Search & Filter
  protected searchTerm = signal<string>('');
  protected statusFilter = signal<string>('All');

  // Checkbox multi-select selection state
  protected selectedIds = signal<Set<string>>(new Set<string>());

  // XAI Modal state
  protected selectedXaiApp = signal<ApplicationInfo | null>(null);
  protected isXaiModalOpen = signal<boolean>(false);
  protected activeResumeTab = signal<'pdf' | 'highlights'>('pdf');
  protected resumeText = signal<string>('');
  protected highlightedHtml = signal<SafeHtml>('');
  protected isResumeTextLoading = signal<boolean>(false);

  // Scheduling state
  protected isScheduleModalOpen = signal<boolean>(false);
  protected scheduleType = signal<'Aptitude' | 'GD' | 'Interview'>('Aptitude');
  protected scheduleDate: string = '';
  protected scheduleTime: string = '';
  protected scheduleLocation: string = 'Online';
  protected scheduleMeetingUrl: string = '';
  protected scheduleIsSubmitting = signal<boolean>(false);

  // Result Declaration Modal state
  protected isResultModalOpen = signal<boolean>(false);
  protected resultStage = signal<'Aptitude' | 'GD' | 'Interview'>('Aptitude');
  protected resultValue = signal<string>('');
  protected resultScore = signal<number | null>(null);
  protected resultFeedback = signal<string>('');
  protected resultIsSubmitting = signal<boolean>(false);

  // Pagination state
  protected currentPage = signal<number>(1);
  protected pageSize: number = 10;

  // Statistics
  protected topCandidate = computed(() => {
    const list = this.applications();
    if (list.length === 0) return null;
    return list[0];
  });

  protected averageScore = computed(() => {
    const list = this.applications();
    if (list.length === 0) return 0;
    const total = list.reduce((sum, app) => sum + (app.aiMatchScore || 0), 0);
    return Math.round((total / list.length) * 10) / 10;
  });

  protected totalCount = computed(() => this.applications().length);
  
  protected appliedCount = computed(() => 
    this.applications().filter(app => this.getFriendlyStatus(app.status) === 'Applied').length
  );
  
  protected shortlistedCount = computed(() => 
    this.applications().filter(app => this.getFriendlyStatus(app.status) === 'Shortlisted').length
  );
  
  protected rejectedCount = computed(() => 
    this.applications().filter(app => this.getFriendlyStatus(app.status) === 'Rejected').length
  );

  protected pendingCount = computed(() => 
    this.applications().filter(app => {
      const s = this.getFriendlyStatus(app.status);
      return s !== 'Shortlisted' && s !== 'Rejected';
    }).length
  );

  // Computed: are all selected candidates already scheduled/completed for each stage?
  // (Disables the schedule button to prevent duplicate scheduling)
  protected aptitudeStageStatuses = [
    'Aptitude Scheduled', 'Aptitude Completed',
    'GD Scheduled', 'GD Completed',
    'Interview Scheduled', 'Interview Completed',
    'Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Offer Declined'
  ];
  protected gdStageStatuses = [
    'GD Scheduled', 'GD Completed',
    'Interview Scheduled', 'Interview Completed',
    'Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Offer Declined'
  ];
  protected interviewStageStatuses = [
    'Interview Scheduled', 'Interview Completed',
    'Selected', 'Placed', 'Offer Sent', 'Offer Accepted', 'Offer Declined'
  ];

  /** Returns true if ALL selected candidates are already scheduled/past for the Aptitude stage */
  protected allSelectedAptitudeScheduled = computed(() => {
    const ids = this.selectedIds();
    if (ids.size === 0) return false;
    const selected = this.applications().filter(a => ids.has(a.applicationId));
    return selected.every(a => this.aptitudeStageStatuses.includes(a.status));
  });

  /** Returns true if ALL selected candidates are already scheduled/past for the GD stage */
  protected allSelectedGdScheduled = computed(() => {
    const ids = this.selectedIds();
    if (ids.size === 0) return false;
    const selected = this.applications().filter(a => ids.has(a.applicationId));
    return selected.every(a => this.gdStageStatuses.includes(a.status));
  });

  /** Returns true if ALL selected candidates are already scheduled/past for the Interview stage */
  protected allSelectedInterviewScheduled = computed(() => {
    const ids = this.selectedIds();
    if (ids.size === 0) return false;
    const selected = this.applications().filter(a => ids.has(a.applicationId));
    return selected.every(a => this.interviewStageStatuses.includes(a.status));
  });

  /** Returns count of selected candidates already scheduled for the given stage type */
  protected alreadyScheduledCount(type: 'Aptitude' | 'GD' | 'Interview'): number {
    const ids = this.selectedIds();
    if (ids.size === 0) return 0;
    const selected = this.applications().filter(a => ids.has(a.applicationId));
    const statuses = type === 'Aptitude' ? this.aptitudeStageStatuses
                    : type === 'GD' ? this.gdStageStatuses
                    : this.interviewStageStatuses;
    return selected.filter(a => statuses.includes(a.status)).length;
  }



  // Filtered & Searched list
  protected filteredApplications = computed(() => {
    let list = this.applications();
    const query = this.searchTerm().trim().toLowerCase();
    const filter = this.statusFilter();

    if (query) {
      list = list.filter(app => 
        (app.student?.name || '').toLowerCase().includes(query) ||
        (app.student?.rollNumber || '').toLowerCase().includes(query)
      );
    }

    if (filter !== 'All') {
      list = list.filter(app => this.getFriendlyStatus(app.status) === filter);
    }

    return list;
  });

  protected pagedApplications = computed(() => {
    const list = this.filteredApplications();
    const page = this.currentPage();
    const size = this.pageSize;
    const startIndex = (page - 1) * size;
    return list.slice(startIndex, startIndex + size);
  });

  protected totalPages = computed(() => 
    Math.ceil(this.filteredApplications().length / this.pageSize) || 1
  );

  protected pageNumbers = computed(() => {
    const pages = this.totalPages();
    return Array.from({ length: pages }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.driveId = params['driveId'] || '';
      if (this.driveId) {
        this.fetchApplications();
      } else {
        this.errorMessage.set('No Drive ID provided.');
        this.isLoading.set(false);
      }
    });
  }

  protected fetchApplications(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.recruiterService.getDriveApplications(this.driveId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.data) {
          this.driveTitle.set(res.data.driveTitle);
          this.driveDescription.set(res.data.driveDescription || '');
          this.companyName.set(res.data.companyName);
          this.driveHasAptitude.set(res.data.hasAptitudeTest !== false);
          this.driveHasGD.set(res.data.hasGD !== false);
          
          const rawApps = res.data.applications || [];
          const sortedApps = [...rawApps].sort((a: any, b: any) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0));
          this.applications.set(sortedApps);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to fetch applications.');
        console.error('Fetch applications error:', err);
      }
    });
  }

  protected getFriendlyStatus(dbStatus: string): 'Applied' | 'Shortlisted' | 'Rejected' {
    if (dbStatus === 'Applied') return 'Applied';
    if (dbStatus === 'Rejected') return 'Rejected';
    return 'Shortlisted'; // All other stages (GD, Interview, Placed, etc.) are Shortlisted/Advanced
  }

  protected formatMatchScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '0.0';
    const val = score <= 1.0 ? score * 100 : score;
    return val.toFixed(1);
  }

  protected getScoreColorClass(score: number | null | undefined): string {
    if (score === null || score === undefined) return 'score-gray';
    const percent = score <= 1.0 ? score * 100 : score;
    if (percent >= 80) return 'score-green';
    if (percent >= 60) return 'score-yellow';
    return 'score-red';
  }

  protected goBack(): void {
    this.router.navigate(['/recruiter/dashboard']);
  }

  // --- Checkbox Selection Handlers ---
  protected isAllSelected(): boolean {
    const visible = this.filteredApplications();
    if (visible.length === 0) return false;
    return visible.every(app => this.selectedIds().has(app.applicationId));
  }

  protected toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentSet = new Set(this.selectedIds());
    const visible = this.filteredApplications();

    visible.forEach(app => {
      if (app.isPlacedGlobally) return;
      if (checked) {
        currentSet.add(app.applicationId);
      } else {
        currentSet.delete(app.applicationId);
      }
    });

    this.selectedIds.set(currentSet);
  }

  protected toggleSelectApp(appId: string): void {
    const app = this.applications().find(a => a.applicationId === appId);
    if (app && app.isPlacedGlobally) return;

    const currentSet = new Set(this.selectedIds());
    if (currentSet.has(appId)) {
      currentSet.delete(appId);
    } else {
      currentSet.add(appId);
    }
    this.selectedIds.set(currentSet);
  }

  // --- Individual Actions ---
  protected shortlistApp(appId: string): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    
    // Map Shortlisted status to "Under Review" in DB
    this.recruiterService.updateApplicationStatus(appId, 'Under Review').subscribe({
      next: () => {
        this.successMessage.set('Candidate shortlisted successfully!');
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Failed to update status.');
        console.error('Update status error:', err);
      }
    });
  }

  protected rejectApp(appId: string): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.recruiterService.updateApplicationStatus(appId, 'Rejected').subscribe({
      next: () => {
        this.successMessage.set('Candidate application rejected.');
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Failed to update status.');
        console.error('Update status error:', err);
      }
    });
  }

  // --- Bulk Actions ---
  protected bulkShortlist(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isLoading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const requests = ids.map(id => this.recruiterService.updateApplicationStatus(id, 'Under Review'));
    forkJoin(requests).subscribe({
      next: () => {
        this.selectedIds.set(new Set<string>());
        this.successMessage.set(`Successfully shortlisted ${ids.length} candidates!`);
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed during bulk status update.');
        console.error('Bulk update error:', err);
      }
    });
  }

  protected bulkReject(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.isLoading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const requests = ids.map(id => this.recruiterService.updateApplicationStatus(id, 'Rejected'));
    forkJoin(requests).subscribe({
      next: () => {
        this.selectedIds.set(new Set<string>());
        this.successMessage.set(`Rejected ${ids.length} candidate applications.`);
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Failed during bulk status update.');
        console.error('Bulk update error:', err);
      }
    });
  }

  protected getStatusLabel(app: any): string {
    if (app.status === 'Interview Completed' && app.interview?.result === 'Selected') {
      return 'Selected';
    }
    return app.status;
  }

  protected getStatusClass(app: any): string {
    const label = this.getStatusLabel(app);
    return label.replace(/\s+/g, '-');
  }

  protected markBulkResult(stage: 'Aptitude' | 'GD' | 'Interview', result: string): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const selectedApps = this.applications().filter(app => ids.includes(app.applicationId));
    
    for (const app of selectedApps) {
      if (stage === 'Aptitude') {
        if (app.status !== 'Aptitude Scheduled' && app.status !== 'Aptitude Completed') {
          this.errorMessage.set(`Warning: ${app.student?.name || 'Student'} has not been scheduled for the Aptitude round yet.`);
          this.successMessage.set(null);
          return;
        }
      } else if (stage === 'GD') {
        if (app.status !== 'GD Scheduled' && app.status !== 'GD Completed') {
          this.errorMessage.set(`Warning: ${app.student?.name || 'Student'} has not been scheduled for Group Discussion yet.`);
          this.successMessage.set(null);
          return;
        }
      } else if (stage === 'Interview') {
        if (app.status !== 'Interview Scheduled' && app.status !== 'Interview Completed') {
          this.errorMessage.set(`Warning: ${app.student?.name || 'Student'} has not been scheduled for Interviews yet.`);
          this.successMessage.set(null);
          return;
        }
      }
    }

    this.resultStage.set(stage);
    this.resultValue.set(result);
    this.resultScore.set(null);
    this.resultFeedback.set('');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isResultModalOpen.set(true);
  }

  protected closeResultModal(): void {
    this.isResultModalOpen.set(false);
    this.resultScore.set(null);
    this.resultFeedback.set('');
  }

  protected get isResultFormValid(): boolean {
    const score = this.resultScore();
    const feedback = this.resultFeedback().trim();
    const isScoreValid = score !== null && score !== undefined && !isNaN(score) && score >= 0;
    const isFeedbackValid = feedback.length > 0;
    return isScoreValid && isFeedbackValid;
  }

  protected submitBulkResult(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) {
      this.closeResultModal();
      return;
    }

    if (!this.isResultFormValid) {
      this.errorMessage.set('Please provide both Marks / Score and Performance Feedback before submitting.');
      return;
    }

    const stage = this.resultStage();
    const result = this.resultValue();
    const score = this.resultScore();
    const feedback = this.resultFeedback().trim();

    this.resultIsSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    let request$;
    if (stage === 'Aptitude') {
      request$ = this.recruiterService.declareAptitudeResults(ids, result, score !== null ? score : undefined, feedback);
    } else if (stage === 'GD') {
      request$ = this.recruiterService.declareGDResults(ids, result, score !== null ? score : undefined, feedback);
    } else {
      request$ = this.recruiterService.declareInterviewResults(ids, result, score !== null ? score : undefined, feedback);
    }

    request$.subscribe({
      next: (res) => {
        this.resultIsSubmitting.set(false);
        this.closeResultModal();
        this.successMessage.set(`${ids.length} candidates marked as ${result} successfully!`);
        this.selectedIds.set(new Set<string>()); // clear selections
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 3500);
      },
      error: (err) => {
        this.resultIsSubmitting.set(false);
        this.errorMessage.set(err.error?.message || `Failed to update results for the selected candidates.`);
      }
    });
  }

  protected resumeTextError = signal<string | null>(null);

  // --- Offer Modal Control ---
  protected isOfferModalOpen = signal<boolean>(false);
  protected selectedOfferApp = signal<ApplicationInfo | null>(null);
  protected offerFile: File | null = null;
  protected offerIsSubmitting = signal<boolean>(false);

  protected openOfferModal(app: ApplicationInfo): void {
    this.selectedOfferApp.set(app);
    this.offerFile = null;
    this.isOfferModalOpen.set(true);
  }

  protected closeOfferModal(): void {
    this.selectedOfferApp.set(null);
    this.offerFile = null;
    this.isOfferModalOpen.set(false);
  }

  protected onOfferFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      this.offerFile = file;
    } else if (file) {
      this.errorMessage.set('Please select a valid PDF document (.pdf).');
      setTimeout(() => this.errorMessage.set(null), 4000);
      event.target.value = '';
    }
  }

  protected submitOfferLetter(): void {
    const app = this.selectedOfferApp();
    if (!app || !this.offerFile) return;

    this.offerIsSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.recruiterService.uploadOfferLetter(app.applicationId, this.offerFile).subscribe({
      next: (res) => {
        this.offerIsSubmitting.set(false);
        this.closeOfferModal();
        this.successMessage.set(`Offer letter uploaded and sent to ${app.student?.name || 'candidate'} successfully! 🎉`);
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.offerIsSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to upload offer letter.');
      }
    });
  }

  // --- Bulk Aptitude Modal Control ---
  protected isBulkAptitudeModalOpen = signal<boolean>(false);
  protected bulkCutoffScore = signal<number>(70);
  protected bulkCsvContent = signal<string>('');
  protected parsedCandidateScores = signal<{ rollNumber: string; score: number; status: 'Passed' | 'Failed' }[]>([]);
  protected bulkAptitudeIsSubmitting = signal<boolean>(false);
  protected bulkAptitudeSummary = signal<any | null>(null);

  protected openBulkAptitudeModal(): void {
    this.bulkCutoffScore.set(70);
    this.bulkCsvContent.set('');
    this.parsedCandidateScores.set([]);
    this.bulkAptitudeSummary.set(null);
    this.isBulkAptitudeModalOpen.set(true);
  }

  protected closeBulkAptitudeModal(): void {
    this.isBulkAptitudeModalOpen.set(false);
    this.bulkAptitudeSummary.set(null);
  }

  protected onBulkCutoffChange(cutoff: number): void {
    this.bulkCutoffScore.set(cutoff);
    this.parseCsvData();
  }

  protected onBulkCsvFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result || '';
      this.bulkCsvContent.set(text);
      this.parseCsvData();
    };
    reader.readAsText(file);
  }

  protected onCsvTextInput(text: string): void {
    this.bulkCsvContent.set(text);
    this.parseCsvData();
  }

  protected parseCsvData(): void {
    const text = this.bulkCsvContent().trim();
    if (!text) {
      this.parsedCandidateScores.set([]);
      return;
    }

    const cutoff = Number(this.bulkCutoffScore()) || 0;
    const lines = text.split(/\r?\n/);
    const parsed: { rollNumber: string; score: number; status: 'Passed' | 'Failed' }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('roll')) continue;
      const parts = trimmed.split(/[,;\t\s]+/);
      if (parts.length >= 2) {
        const rollNumber = parts[0].trim();
        const scoreNum = parseFloat(parts[1].trim());
        if (rollNumber && !isNaN(scoreNum)) {
          parsed.push({
            rollNumber,
            score: scoreNum,
            status: scoreNum >= cutoff ? 'Passed' : 'Failed',
          });
        }
      }
    }

    this.parsedCandidateScores.set(parsed);
  }

  protected submitBulkAptitudeEvaluation(): void {
    const driveId = this.driveId;
    if (!driveId) return;

    const scores = this.parsedCandidateScores();
    const cutoff = this.bulkCutoffScore();
    const csv = this.bulkCsvContent();

    if (!scores.length && !csv.trim()) {
      this.errorMessage.set('Please provide valid CSV scores or upload a CSV file.');
      return;
    }

    this.bulkAptitudeIsSubmitting.set(true);
    this.errorMessage.set(null);

    this.recruiterService.bulkUploadAptitudeScores(driveId, cutoff, scores, csv).subscribe({
      next: (res) => {
        this.bulkAptitudeIsSubmitting.set(false);
        if (res && res.summary) {
          this.bulkAptitudeSummary.set(res.summary);
          this.fetchApplications();
        }
      },
      error: (err) => {
        this.bulkAptitudeIsSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to process bulk aptitude scores.');
      }
    });
  }

  // --- XAI Modal Control ---
  protected openXaiModal(app: ApplicationInfo): void {
    this.selectedXaiApp.set(app);
    this.activeResumeTab.set('pdf');
    this.resumeText.set('');
    this.highlightedHtml.set('');
    this.resumeTextError.set(null);
    this.isResumeTextLoading.set(true);
    this.isXaiModalOpen.set(true);

    this.recruiterService.getResumeText(app.applicationId).subscribe({
      next: (res) => {
        this.resumeText.set(res.text || '');
        this.generateHighlights(res.text || '', app);
        this.isResumeTextLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load resume text:', err);
        this.resumeText.set('');
        this.highlightedHtml.set('');
        this.resumeTextError.set(err.error?.message || 'Unable to extract candidate resume text from server disk.');
        this.isResumeTextLoading.set(false);
      }
    });
  }

  protected closeXaiModal(): void {
    this.selectedXaiApp.set(null);
    this.isXaiModalOpen.set(false);
    this.activeResumeTab.set('pdf');
    this.resumeText.set('');
    this.highlightedHtml.set('');
  }

  protected generateHighlights(text: string, app: ApplicationInfo): void {
    if (!text) {
      this.highlightedHtml.set('');
      return;
    }

    // Escape raw HTML characters to prevent cross-origin issues
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const TECH_KEYWORDS = [
      'react', 'angular', 'vue', 'next.js', 'nextjs', 'node.js', 'nodejs', 'express', 'mongodb', 
      'mongo', 'python', 'flask', 'fastapi', 'sql', 'mysql', 'postgres', 'postgresql', 'c++', 
      'c#', 'java', 'html', 'css', 'git', 'docker', 'aws', 'kubernetes', 'javascript', 'typescript',
      'deep learning', 'machine learning', 'pytorch', 'tensorflow', 'django', 'php', 'laravel'
    ];

    const jdLower = (this.driveDescription() || '').toLowerCase();
    const resumeLower = text.toLowerCase();
    
    // Find tech keywords mentioned in the JD
    const jdKeywords = TECH_KEYWORDS.filter(kw => {
      const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
      return regex.test(jdLower);
    });

    // Of those JD keywords, find which ones are in the candidate's resume
    const jdMatches = jdKeywords.filter(kw => {
      const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
      return regex.test(resumeLower);
    });

    // Also collect all keywords from strongSkills, positiveSentences match lists
    const strongSkills = app.xai?.strongSkills || [];
    const positiveSents = app.xai?.positiveSentences || [];
    let dbMatches: string[] = [...strongSkills];
    if (dbMatches.length === 0) {
      const matchLine = positiveSents.find(s => s.toLowerCase().includes('matching technologies'));
      if (matchLine) {
        const parts = matchLine.split(':');
        if (parts.length > 1) {
          dbMatches = parts[1].split(',').map(k => k.trim().replace(/\.$/, ''));
        }
      }
    }

    // Combine both sets of matching keywords (case-insensitive deduplication)
    const combinedMatches = new Set<string>();
    jdMatches.forEach(kw => combinedMatches.add(kw.toUpperCase()));
    dbMatches.forEach(kw => combinedMatches.add(kw.toUpperCase()));

    let matchedKeywords = Array.from(combinedMatches);

    // Dynamically calculate missing skills (present in JD but not in Resume)
    const dynamicSkillGaps = jdKeywords
      .filter(kw => !jdMatches.includes(kw))
      .map(kw => kw.toUpperCase());

    // Merge with DB skill gaps (deduplicated)
    const combinedSkillGaps = new Set<string>();
    (app.xai?.skillGaps || []).forEach(s => combinedSkillGaps.add(s.toUpperCase()));
    dynamicSkillGaps.forEach(s => combinedSkillGaps.add(s));
    
    if (app.xai) {
      app.xai.skillGaps = Array.from(combinedSkillGaps);
    }

    // Replace matching keywords with styled span (Green highlight)
    if (matchedKeywords.length > 0) {
      // Sort keywords by length descending to prevent substring replace conflicts (e.g. node.js vs node)
      matchedKeywords = matchedKeywords.filter(Boolean).sort((a, b) => b.length - a.length);
      
      matchedKeywords.forEach(kw => {
        if (!kw) return;
        const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Match case-insensitively, boundary safe
        const regex = new RegExp(`\\b(${escapedKw})\\b`, 'gi');
        escaped = escaped.replace(regex, `<span style="background-color: #D4EFDF !important; color: #196F3D !important; padding: 2px 4px; border-radius: 4px; font-weight: 850; display: inline-block;">$1</span>`);
      });
    }

    // Replace linebreaks with <br> for display formatting
    escaped = escaped.replace(/\n/g, '<br>');
    this.highlightedHtml.set(this.sanitizer.bypassSecurityTrustHtml(escaped));
  }

  protected getResumeUrl(path: string | undefined): SafeResourceUrl | null {
    if (!path) return null;
    const fullUrl = `http://localhost:5000${path}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
  }

  // --- Scheduling Actions ---
  protected scheduleDateTouched = false;
  protected scheduleTimeTouched = false;

  protected get isDateValid(): boolean {
    return !!this.scheduleDate && this.scheduleDate >= this.todayDate;
  }

  protected get isTimeValid(): boolean {
    if (!this.scheduleTime) return false;
    const regex = /^\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)$/i;
    return regex.test(this.scheduleTime.trim());
  }

  protected get isLocationValid(): boolean {
    if (this.scheduleLocation === undefined || this.scheduleLocation === null) return true;
    return this.scheduleLocation.trim().length > 0;
  }

  protected get isScheduleFormValid(): boolean {
    return this.isDateValid && this.isTimeValid && this.isLocationValid;
  }

  /** Checks if a specific candidate is eligible to be scheduled for a round */
  protected isCandidateEligibleForStage(app: ApplicationInfo, stage: 'Aptitude' | 'GD' | 'Interview'): boolean {
    if (app.status === 'Rejected') return false;

    if (stage === 'Aptitude') {
      return app.aptitude?.status !== 'Failed';
    }

    if (stage === 'GD') {
      if (this.driveHasAptitude()) {
        return app.aptitude?.status === 'Passed' || app.status === 'Aptitude Completed';
      }
      return true;
    }

    if (stage === 'Interview') {
      if (this.driveHasGD()) {
        return app.gd?.status === 'Shortlisted' || app.status === 'GD Completed';
      }
      if (this.driveHasAptitude()) {
        return app.aptitude?.status === 'Passed' || app.status === 'Aptitude Completed';
      }
      return true;
    }

    return true;
  }

  /** Returns count of selected candidates who are eligible for the given stage */
  protected eligibleForStageCount(stage: 'Aptitude' | 'GD' | 'Interview'): number {
    const ids = this.selectedIds();
    if (ids.size === 0) return 0;
    const selected = this.applications().filter(a => ids.has(a.applicationId));
    return selected.filter(a => this.isCandidateEligibleForStage(a, stage)).length;
  }

  protected openScheduleModal(type: 'Aptitude' | 'GD' | 'Interview'): void {
    if (this.selectedIds().size === 0) {
      this.errorMessage.set('Please select at least one candidate.');
      return;
    }

    const totalSelected = this.selectedIds().size;

    // Check prior round pass eligibility
    const eligibleCount = this.eligibleForStageCount(type);

    if (eligibleCount === 0) {
      const priorRoundName = type === 'GD' ? 'Aptitude Test' : (this.driveHasGD() ? 'Group Discussion (GD)' : 'Aptitude Test');
      this.errorMessage.set(
        `None of the ${totalSelected} selected candidate(s) are eligible for ${type}. ` +
        `Candidates must pass the ${priorRoundName} round first before being scheduled.`
      );
      setTimeout(() => this.errorMessage.set(null), 6000);
      return;
    }

    if (eligibleCount < totalSelected) {
      const ineligibleCount = totalSelected - eligibleCount;
      const priorRoundName = type === 'GD' ? 'Aptitude Test' : (this.driveHasGD() ? 'Group Discussion (GD)' : 'Aptitude Test');
      this.errorMessage.set(
        `⚠️ Notice: ${ineligibleCount} of ${totalSelected} selected candidate(s) did not pass the ${priorRoundName} round and will be skipped.`
      );
      setTimeout(() => this.errorMessage.set(null), 5000);
    }

    // Check if any already-scheduled candidates are in the selection
    const alreadyCount = this.alreadyScheduledCount(type);

    if (alreadyCount === totalSelected) {
      // All selected are already scheduled — block completely
      this.errorMessage.set(
        `All ${totalSelected} selected candidate(s) have already been scheduled for ${type}. ` +
        `Please deselect them or choose candidates who haven't been scheduled yet.`
      );
      setTimeout(() => this.errorMessage.set(null), 6000);
      return;
    }

    if (alreadyCount > 0) {
      // Some are already scheduled — warn but allow (backend will handle duplicates)
      this.errorMessage.set(
        `⚠️ Warning: ${alreadyCount} of ${totalSelected} selected candidate(s) are already scheduled for ${type} and will be skipped.`
      );
      setTimeout(() => this.errorMessage.set(null), 5000);
    }

    this.scheduleType.set(type);
    this.scheduleDate = '';
    this.scheduleTime = '';
    this.scheduleLocation = 'Online';
    this.scheduleMeetingUrl = '';
    this.scheduleDateTouched = false;
    this.scheduleTimeTouched = false;
    this.isScheduleModalOpen.set(true);
  }

  protected closeScheduleModal(): void {
    this.isScheduleModalOpen.set(false);
  }

  protected submitSchedule(): void {
    this.scheduleDateTouched = true;
    this.scheduleTimeTouched = true;

    if (!this.isScheduleFormValid) {
      this.errorMessage.set('Please fix form validation errors before scheduling.');
      return;
    }

    this.scheduleIsSubmitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const applicationIds = Array.from(this.selectedIds());

    const payload = {
      applicationIds,
      eventType: this.scheduleType(),
      date: this.scheduleDate,
      timeSlot: this.scheduleTime,
      location: this.scheduleLocation,
      meetingUrl: this.scheduleMeetingUrl
    };

    this.recruiterService.scheduleEvent(payload).subscribe({
      next: (res) => {
        this.scheduleIsSubmitting.set(false);
        this.closeScheduleModal();
        this.selectedIds.set(new Set<string>());
        this.successMessage.set(res.message || `Successfully scheduled ${this.scheduleType()}!`);
        this.fetchApplications();
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (err) => {
        this.scheduleIsSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to schedule stage.');
        console.error('Schedule stage error:', err);
      }
    });
  }

  // --- Pagination Actions ---
  protected setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  protected prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  protected exportCandidatesToCSV(): void {
    const apps = this.applications();
    if (apps.length === 0) return;

    // Header row
    const headers = ['Roll Number', 'Name', 'Email', 'Branch', 'CGPA', 'AI Fit Score (%)', 'Status', 'Applied Date'];
    const rows = apps.map((a) => [
      a.student ? a.student.rollNumber : '',
      a.student ? `"${a.student.name.replace(/"/g, '""')}"` : '',
      a.student ? (a.student as any).userId?.email || '' : '',
      a.student ? a.student.branch : '',
      a.student ? a.student.cgpa : '',
      a.aiMatchScore !== null && a.aiMatchScore !== undefined ? a.aiMatchScore : '',
      a.status,
      a.appliedDate ? new Date(a.appliedDate).toLocaleDateString() : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Candidates_${this.driveTitle().replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
